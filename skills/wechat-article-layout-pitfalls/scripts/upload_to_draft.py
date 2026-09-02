#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键把公众号推文（Markdown 或 已排版 HTML）推进草稿箱。

支持两种输入：
  1. .html —— 已按公众号规范排好的 HTML（内联样式、base64/本地图片）
  2. .md  —— Markdown 源稿，脚本会先渲染为基础 HTML，再走换图 → 上传

无论哪种输入，正文图片都会被逐张上传到微信图床换成 mmbiz URL（draft/add
会过滤 base64 和外链图片），封面会传为永久素材拿 thumb_media_id。

┌─ 改稿红线（2026-09-02 事故后并入，不可绕过）───────────────────────────────┐
│ 已经推送进草稿箱的文章，再修改时必须就地增量更新（--update-media-id），      │
│ 严禁用 draft/add 新建 + 删除的方式"重传"——那会把运营者在后台手动调整过的    │
│ 头图、标题、摘要、文字一并删掉，且删除不可恢复。                             │
│ 三道安全闸：                                                               │
│  ① 台账加锁——同源文件再次裸 add 会被拒绝（红字提示改走增量更新）；          │
│  ② 自动备份——每次更新前把草稿箱当前内容备份到 draft-backups/（人工版永不丢）;│
│  ③ 人工编辑检测——草稿内容 hash 与上次推送基线不一致（＝后台被人工改过），    │
│     默认拒绝推送，须把人工修改合并进本地源再带 --force 才放行。              │
│ 增量更新时不传 --title/--digest/--cover 就沿用草稿箱当前值——后台改过的标题、│
│ 摘要、封面天然保留，只替换正文。                                           │
└──────────────────────────────────────────────────────────────────────────┘

前置：
  - 环境变量或 Windows 注册表提供 WECHAT_MP_APPID / WECHAT_MP_APPSECRET
    （旧 WX_APPID / WX_APPSECRET 仍兼容，但优先使用 WECHAT_MP_* 命名）。
  - 运行脚本的机器公网出口 IP 已加入公众号后台 IP 白名单。
  - 依赖：requests, beautifulsoup4, pillow；Markdown 输入时还需要 markdown。

用法（.html / .md 均已排版或源稿）：
  首次推送：
    python3 upload_to_draft.py article.html \
        --title "标题（≤32字）" --author "作者" --digest "摘要" --cover 封面.jpg

  修改已推送的文章（增量，media_id 不变，草稿箱里永远只有这一份）：
    python3 upload_to_draft.py article.html --update-media-id <media_id>
    （不传 --title/--digest/--cover 时，沿用草稿箱当前值——后台手动改过的标题、
      摘要、封面不会被冲掉；只有 content 会被新源替换）

  只备份/登记当前草稿内容（把后台人工版导出到本地，不推送）：
    python3 upload_to_draft.py article.html --update-media-id <media_id> --export-current

  人工改过草稿、且已把人工修改合并进新源之后的强制推送：
    python3 upload_to_draft.py article.html --update-media-id <media_id> --force

本脚本只做到「进草稿箱」为止，不自动群发/发布；最后一步由人工在
mp.weixin.qq.com 后台或手机端公众号助手确认。
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# Windows 控制台中文输出兜底（中文在部分终端会变乱码）
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

API = "https://api.weixin.qq.com/cgi-bin"
TOKEN_CACHE = Path(".wx_token_cache.json")
MANIFEST = Path(".wx_draft_manifest.json")       # 推送台账：源文件名 → media_id + 内容基线 hash
BACKUP_DIR = Path("draft-backups")               # 每次 update 前的人工版备份目录
MMBIZ_HOSTS = ("mmbiz.qpic.cn", "mmbiz.qlogo.cn")

MAX_TITLE = 32
MAX_AUTHOR = 16
MAX_DIGEST = 120
# 微信官方正文上限是体积 <1MB（无单独字符数上限）。0.6.1 起移除旧版
# MAX_CONTENT_CHARS=20000 的自设字符校验——2026-08-20 实测 38,102 字符
# （46.6KB）正文 draft/add 照收、回读完整，证明该字符线并非微信政策。
MAX_CONTENT_BYTES = 1_000_000


class WeChatError(RuntimeError):
    pass


def _jresp(r) -> dict:
    """统一按 UTF-8 解码微信响应。requests 对无 charset 的响应会误判成 latin-1，
    中文被拆成双倍字符（曾导致 45110 author size out of limit）。"""
    return json.loads(r.content.decode("utf-8"))


# ---------- 凭据 ----------
def get_credentials() -> tuple[str, str]:
    """读取 WECHAT_MP_APPID / WECHAT_MP_APPSECRET；兼容旧命名 WX_APPID / WX_APPSECRET。"""
    appid = (os.environ.get("WECHAT_MP_APPID") or os.environ.get("WX_APPID", "")).strip()
    secret = (os.environ.get("WECHAT_MP_APPSECRET") or os.environ.get("WX_APPSECRET", "")).strip()
    if appid and secret:
        return appid, secret
    if sys.platform == "win32":
        reg_appid, reg_secret = _read_registry_credentials()
        if not appid and reg_appid:
            appid = reg_appid
        if not secret and reg_secret:
            secret = reg_secret
    if not secret and sys.stdin.isatty():
        secret = getpass.getpass("WeChat AppSecret(不显示): ").strip()
    if not appid or not secret:
        raise WeChatError(
            "缺少 WECHAT_MP_APPID / WECHAT_MP_APPSECRET（或旧命名 WX_APPID / WX_APPSECRET）。"
            "\n  方式一: export WECHAT_MP_APPID=wx... WECHAT_MP_APPSECRET=..."
            "\n  方式二(持久/Windows): [Environment]::SetEnvironmentVariable('WECHAT_MP_APPID','wx...','User')"
        )
    return appid, secret


def _read_registry_credentials() -> tuple[str, str]:
    import re
    try:
        out = subprocess.run(
            ["reg", "query", r"HKCU\Environment", "/v", "WECHAT_MP_APPID"],
            capture_output=True, text=True).stdout
        appid = _parse_reg_value(out)
        out = subprocess.run(
            ["reg", "query", r"HKCU\Environment", "/v", "WECHAT_MP_APPSECRET"],
            capture_output=True, text=True).stdout
        secret = _parse_reg_value(out)
        return (appid or "").strip(), (secret or "").strip()
    except Exception:
        return "", ""


def _parse_reg_value(output: str) -> str:
    for line in output.splitlines():
        if "REG_SZ" in line:
            parts = line.split("REG_SZ", 1)
            if len(parts) == 2:
                return parts[1].strip()
    return ""


# ---------- access_token ----------
def get_access_token(appid: str, secret: str) -> str:
    if TOKEN_CACHE.exists():
        try:
            c = json.loads(TOKEN_CACHE.read_text())
            if c.get("appid") == appid and c.get("expire_at", 0) - 120 > time.time():
                return c["access_token"]
        except Exception:
            pass
    r = _jresp(requests.post(
        f"{API}/stable_token",
        json={"grant_type": "client_credential", "appid": appid, "secret": secret},
        timeout=20,
    ))
    if "access_token" not in r:
        raise WeChatError(_explain(r, "获取 access_token 失败"))
    TOKEN_CACHE.write_text(json.dumps({
        "appid": appid,
        "access_token": r["access_token"],
        "expire_at": time.time() + r.get("expires_in", 7200),
    }))
    return r["access_token"]


# ---------- Markdown 渲染 ----------
def _remove_editorial_sections(source: str) -> str:
    lines = source.splitlines()
    kept, skipping = [], False
    for line in lines:
        if re.match(r"^##\s+(配图建议|发布审核提示)\s*$", line):
            skipping = True
            continue
        if skipping and re.match(r"^##\s+", line):
            skipping = False
        if skipping:
            continue
        if line.startswith("> 备选标题"):
            continue
        kept.append(line)
    return "\n".join(kept).strip() + "\n"


def _extract_article(source: str, title_override: str | None) -> tuple[str, str, str]:
    source = _remove_editorial_sections(source)
    title_match = re.search(r"^#\s+(.+?)\s*$", source, re.M)
    if not title_match and not title_override:
        raise WeChatError("Markdown 缺少一级标题,且未提供 --title。")
    title = (title_override or title_match.group(1).strip())
    source = re.sub(r"^#\s+.+?\s*$", "", source, count=1, flags=re.M)
    deck_match = re.search(r"^##\s+(.+?)\s*$", source, re.M)
    deck = deck_match.group(1).strip() if deck_match else ""
    if deck_match:
        source = source[: deck_match.start()] + source[deck_match.end():]
    source = re.sub(r"^###\s+摘要\s*$", "", source, count=1, flags=re.M)
    return title, deck, source.strip()


def _set_style(tag: Tag, style: str) -> None:
    tag.attrs = {"style": style}


def _style_html(raw_html: str, deck: str) -> str:
    soup = BeautifulSoup(raw_html, "html.parser")
    for tag in soup.find_all(True):
        href, src, alt = tag.get("href"), tag.get("src"), tag.get("alt")
        tag.attrs = {}
        if tag.name == "a" and href:
            tag["href"] = href
        if tag.name == "img" and src:
            tag["src"] = src
            if alt:
                tag["alt"] = alt
    styles = {
        "h2": "margin:2em 0 .9em;padding-bottom:.4em;border-bottom:2px solid #176b87;color:#123c52;font-size:23px;line-height:1.45;",
        "h3": "margin:1.6em 0 .7em;padding-left:.6em;border-left:4px solid #20a0a0;color:#17485d;font-size:19px;line-height:1.55;",
        "blockquote": "margin:1.4em 0;padding:1em;border-left:4px solid #1d8e9f;background:#eef7f8;color:#17485d;font-size:17px;",
        "ul": "margin:.7em 0 1.25em;padding-left:1.5em;",
        "ol": "margin:.7em 0 1.25em;padding-left:1.5em;",
        "li": "margin:.3em 0;",
        "strong": "color:#0f6077;font-weight:700;",
        "code": "padding:2px 5px;background:#edf3f5;color:#b54832;font-size:14px;word-break:break-all;",
        "pre": "margin:1.2em 0;padding:1em;background:#16303f;color:#fff;font-size:14px;white-space:pre-wrap;word-break:break-all;",
        "hr": "margin:2em auto;border:0;border-top:1px solid #d9e4e8;",
        "a": "color:#167b96;text-decoration:underline;",
        "img": "display:block;max-width:100%;height:auto;margin:1.5em auto;",
    }
    for name, style in styles.items():
        for tag in soup.find_all(name):
            preserved = dict(tag.attrs)
            _set_style(tag, style)
            tag.attrs.update(preserved)
    for pre in soup.find_all("pre"):
        for code in pre.find_all("code"):
            code.attrs = {}
    for list_tag in soup.find_all(["ul", "ol"]):
        for child in list(list_tag.children):
            if isinstance(child, NavigableString) and not child.strip():
                child.extract()
        for item in list(list_tag.find_all("li", recursive=False)):
            if not item.get_text(strip=True) and not item.find(["img", "br"]):
                item.decompose()
    wrapper = soup.new_tag("section")
    wrapper["style"] = ("margin:0 auto;padding:0 6px;max-width:677px;color:#26384a;"
                        "font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',Arial,sans-serif;"
                        "font-size:16px;line-height:1.9;letter-spacing:.02em;word-break:break-word;")
    if deck:
        lead = soup.new_tag("section")
        lead["style"] = ("margin:8px 0 30px;padding:18px 20px;border-radius:8px;"
                         "background:#123c52;color:#fff;font-size:17px;line-height:1.8;font-weight:600;")
        lead.append(NavigableString(deck))
        wrapper.append(lead)
    for child in list(soup.contents):
        wrapper.append(child.extract())
    return str(wrapper)


def render_markdown(path: Path, title_override: str | None) -> tuple[str, str, str]:
    try:
        import markdown as md
    except ImportError:
        raise WeChatError("处理 Markdown 需要安装 markdown: pip install markdown")
    source = path.read_text(encoding="utf-8")
    title, deck, body_md = _extract_article(source, title_override)
    raw_html = md.markdown(body_md, extensions=["extra", "sane_lists"])
    content = _style_html(raw_html, deck)
    text = BeautifulSoup(content, "html.parser").get_text(" ", strip=True)
    digest = re.sub(r"\s+", "", text)[:MAX_DIGEST]
    return title, digest, content


# ---------- 图片处理 ----------
def _normalize_image(raw: bytes, fallback_name: str) -> tuple[bytes, str]:
    if not HAS_PIL:
        return raw, fallback_name
    im = Image.open(io.BytesIO(raw))
    fmt = (im.format or "").upper()
    if fmt not in ("JPEG", "PNG"):
        im = im.convert("RGB")
        fmt = "JPEG"
    if len(raw) <= 1_000_000 and fmt in ("JPEG", "PNG"):
        ext = "jpg" if fmt == "JPEG" else "png"
        return raw, f"{Path(fallback_name).stem}.{ext}"
    if im.mode in ("RGBA", "P"):
        im = im.convert("RGB")
    if im.width > 1080:
        im = im.resize((1080, round(im.height * 1080 / im.width)))
    for q in (85, 75, 65, 55):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q)
        if buf.tell() <= 1_000_000:
            return buf.getvalue(), f"{Path(fallback_name).stem}.jpg"
    return buf.getvalue(), f"{Path(fallback_name).stem}.jpg"


def _img_bytes_from_src(src: str, html_dir: Path) -> bytes | None:
    if src.startswith("data:image"):
        b64 = src.split(",", 1)[1]
        return base64.b64decode(b64)
    if src.startswith(("http://", "https://")):
        return None
    p = (html_dir / src).resolve()
    if p.exists():
        return p.read_bytes()
    return None


def upload_content_image(token: str, raw: bytes, name: str) -> str:
    data, fname = _normalize_image(raw, name)
    files = {"media": (fname, data, "image/jpeg" if fname.endswith("jpg") else "image/png")}
    r = _jresp(requests.post(f"{API}/media/uploadimg", params={"access_token": token},
                             files=files, timeout=60))
    if r.get("errcode", 0) != 0 or "url" not in r:
        raise WeChatError(_explain(r, f"uploadimg 失败（{name}）"))
    return r["url"]


def upload_thumb(token: str, raw: bytes, name: str) -> str:
    data, fname = _normalize_image(raw, name)
    files = {"media": (fname, data, "image/jpeg" if fname.endswith("jpg") else "image/png")}
    r = _jresp(requests.post(f"{API}/material/add_material",
                             params={"access_token": token, "type": "image"},
                             files=files, timeout=60))
    if "media_id" not in r:
        raise WeChatError(_explain(r, "封面上传为永久素材失败"))
    return r["media_id"]


# ---------- HTML 处理 ----------
def process_html(token: str, html_path: Path) -> tuple[str, bytes | None, str | None]:
    html_dir = html_path.parent
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    first_img_bytes, first_img_name = None, None
    for i, img in enumerate(soup.find_all("img")):
        src = img.get("src", "")
        if any(h in src for h in MMBIZ_HOSTS):
            continue
        raw = _img_bytes_from_src(src, html_dir)
        if raw is None:
            print(f"  [跳过] 第{i+1}张图无法读取（外链或路径不存在）：{src[:60]}")
            continue
        name = f"img_{i+1}"
        url = upload_content_image(token, raw, name)
        img["src"] = url
        if first_img_bytes is None:
            first_img_bytes, first_img_name = raw, name
        print(f"  [换图] 第{i+1}张 → {url}")
    body = soup.body or soup
    content = body.decode_contents() if hasattr(body, "decode_contents") else str(soup)
    return content, first_img_bytes, first_img_name


# ---------- draft API ----------
def add_draft(token: str, article: dict) -> str:
    payload = json.dumps({"articles": [article]}, ensure_ascii=False).encode("utf-8")
    r = _jresp(requests.post(f"{API}/draft/add", params={"access_token": token},
                             data=payload, timeout=60))
    if "media_id" not in r:
        raise WeChatError(_explain(r, "draft/add 失败"))
    return r["media_id"]


def get_draft(token: str, media_id: str) -> dict:
    resp = requests.post(f"{API}/draft/get", params={"access_token": token},
                         data=json.dumps({"media_id": media_id}, ensure_ascii=False).encode("utf-8"),
                         timeout=60)
    # 统一用 _jresp 显式 UTF-8 解码（requests 对无 charset 误判 latin-1，会把中文翻倍）
    r = _jresp(resp)
    if r.get("errcode", 0) not in (0, None) and "news_item" not in r:
        raise WeChatError(_explain(r, f"draft/get 失败（media_id={media_id[:20]}…）"))
    return r


def update_draft(token: str, media_id: str, index: int, article: dict) -> None:
    payload = json.dumps({"media_id": media_id, "index": index, "articles": article},
                         ensure_ascii=False).encode("utf-8")
    r = _jresp(requests.post(f"{API}/draft/update", params={"access_token": token},
                             data=payload, timeout=60))
    if r.get("errcode", 0) not in (0, None):
        raise WeChatError(_explain(r, "draft/update 失败"))


# ---------- 台账与备份（改稿红线三道闸） ----------
def _load_manifest() -> dict:
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def _backup_draft(media_id: str, news_item: dict, tag: str) -> Path:
    """把草稿箱当前内容备份到 draft-backups/，返回备份 html 路径。人工版永不丢。"""
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    base = BACKUP_DIR / f"{media_id[:16]}-{tag}-{ts}"
    (base.with_suffix(".json")).write_text(
        json.dumps({"media_id": media_id, "news_item": news_item},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    html_p = base.with_suffix(".html")
    html_p.write_text(news_item.get("content", ""), encoding="utf-8")
    return html_p


def _record_baseline(key: str, media_id: str, token: str) -> None:
    """add/update 之后立即回读草稿箱，把微信规范化后的内容 hash 记为基线。
    供下次 update 时做"后台是否被人工改过"判定。"""
    cur = get_draft(token, media_id)
    item = cur["news_item"][0]
    m = _load_manifest()
    m[key] = {"media_id": media_id, "content_sha": _sha1(item.get("content", "")),
              "pushed_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    _save_manifest(m)


def _explain(resp: dict, prefix: str) -> str:
    code = resp.get("errcode")
    tips = {
        40164: "IP 不在白名单 → 把本机出口 IP 加进 公众号后台→开发→基本配置→IP白名单",
        48001: "个别个人/未认证号直连会遇到（平台口径不一致，多数能用）→ 后台「接口权限」确认草稿/素材项，或改走第三方平台授权 authorizer_access_token，或后台反馈申诉",
        40013: "AppID 不对",
        40125: "AppSecret 不对（后台可重置）",
        45009: "超天级调用频率，次日恢复",
        40005: "图片格式不对（只收 jpg/png）",
        40009: "图片尺寸/大小超限（需 <1MB）",
        40007: "media_id 无效（草稿可能已被后台删除）",
    }
    extra = f"\n  → {tips[code]}" if code in tips else ""
    return f"{prefix}：{resp}{extra}"


def _validate_metadata(title, author, digest, content) -> None:
    failures = []
    if len(title) > MAX_TITLE:
        failures.append(f"标题 {len(title)} 字,超过 {MAX_TITLE} 字")
    if len(author) > MAX_AUTHOR:
        failures.append(f"作者 {len(author)} 字,超过 {MAX_AUTHOR} 字")
    if len(digest) > MAX_DIGEST:
        failures.append(f"摘要 {len(digest)} 字,超过 {MAX_DIGEST} 字")
    if len(content.encode("utf-8")) >= MAX_CONTENT_BYTES:
        failures.append(f"正文 HTML {len(content.encode('utf-8'))} 字节,超过微信官方 1MB 上限")
    if re.search(r"<script\b|\bon\w+\s*=|javascript:", content, re.I):
        failures.append("正文包含脚本或事件属性")
    if failures:
        raise WeChatError("；".join(failures))


# ---------- 主流程 ----------
def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="公众号推文一键进草稿箱（支持 .html 排版稿 / .md 源稿 + 增量更新）")
    ap.add_argument("source", type=Path, help="源文件：.html 已排版稿 或 .md Markdown 稿")
    ap.add_argument("--title", help="标题（≤32字）；Markdown 未提供时必填")
    ap.add_argument("--author", default="", help="作者（≤16字）")
    ap.add_argument("--digest", default="", help="摘要（≤128字）；Markdown 留空自动提取")
    ap.add_argument("--cover", type=Path, help="封面图路径；不传则取正文第一张可上传图片")
    ap.add_argument("--source-url", default="", help="阅读原文链接（可选）")
    ap.add_argument("--update-media-id", help="更新现有草稿而不是新增（改稿必须用这个，media_id 不变）")
    ap.add_argument("--update", dest="update_media_id", help="--update-media-id 的别名")
    ap.add_argument("--export-current", action="store_true",
                    help="只把草稿箱当前内容备份导出到本地并登记基线，不推送（用于先导出人工修改再合并）")
    ap.add_argument("--force", action="store_true",
                    help="检测到草稿在后台被人工改过时，确认人工修改已合并进本地源后用此参数强制推送")
    return ap.parse_args()


def main() -> int:
    args = parse_args()
    source = args.source.resolve()
    if not source.is_file():
        raise WeChatError(f"找不到源文件：{source}")

    # 台账 key：以源文件名锚定（同一篇稿改版也用同一文件名，便于记住 media_id）
    key = source.name
    manifest = _load_manifest()

    suffix = source.suffix.lower()

    print("· 取 access_token …")
    appid, secret = get_credentials()
    token = get_access_token(appid, secret)

    # ===== 路径一：增量更新（改稿唯一正道） =====
    if args.update_media_id or args.export_current:
        media_id = args.update_media_id or (manifest.get(key) or {}).get("media_id")
        if not media_id:
            raise WeChatError("没有可更新的 media_id：请用 --update-media-id <media_id> 指定，"
                              "或先首次推送过一次")
        cur = get_draft(token, media_id)
        item = (cur.get("news_item") or [{}])[0]
        backup_html = _backup_draft(media_id, item, tag="pre-update")
        cur_sha = _sha1(item.get("content", ""))
        baseline = manifest.get(key) or {}
        manual_edited = bool(baseline.get("content_sha")) and baseline["content_sha"] != cur_sha

        print(f"· 草稿箱当前版本已备份 → {backup_html}")
        print(f"  （标题：{item.get('title','')}｜封面 media_id：{(item.get('thumb_media_id') or '')[:20]}…）")

        if args.export_current:
            if not manual_edited and not baseline.get("content_sha"):
                baseline["content_sha"] = cur_sha
            manifest[key] = {**baseline, "media_id": media_id}
            _save_manifest(manifest)
            print(f"\n✅ 已导出并登记基线（未推送）。"
                  f"{'检测到该草稿与基线不一致——后台有人工修改，请先合并进本地源再 --force 推送。' if manual_edited else ''}")
            return 0

        if manual_edited and not args.force:
            print("\n🛑 改稿红线：检测到草稿在后台被人工修改过（内容 hash 与上次推送基线不一致）。")
            print("   人工修改版已备份，为避免冲掉这些修改，本次拒绝推送。")
            print(f"   ① 先查看人工版：{backup_html}")
            print("   ② 把人工修改合并进本地源")
            print("   ③ 确认合并完成后，带 --force 重新运行")
            return 2
        if manual_edited and args.force:
            print("⚠️  --force：人工版已备份，按你的确认覆盖推送。")

    # ===== 渲染/取正文 =====
    if suffix == ".md":
        title, auto_digest, content = render_markdown(source, args.title)
    elif suffix in (".html", ".htm"):
        if not args.title and not (args.update_media_id or args.export_current):
            raise WeChatError("HTML 源稿首次推送必须提供 --title")
        title = args.title or ""
        content = source.read_text(encoding="utf-8")
        text = BeautifulSoup(content, "html.parser").get_text(" ", strip=True)
        auto_digest = re.sub(r"\s+", "", text)[:MAX_DIGEST]
    else:
        raise WeChatError("源文件必须是 .md 或 .html/.htm")

    # 处理正文图片（写临时 HTML 复用换图逻辑）
    print("· 处理正文图片 …")
    tmp_html = source.with_suffix(".tmp_upload.html")
    if re.search(r"<body\b", content, re.I):
        tmp_html.write_text(content, encoding="utf-8")
    else:
        tmp_html.write_text(f"<!doctype html><html><body>{content}</body></html>", encoding="utf-8")
    try:
        content, first_bytes, first_name = process_html(token, tmp_html)
    finally:
        tmp_html.unlink(missing_ok=True)

    # ===== 组装 article dict =====
    if args.update_media_id:
        # 未显式指定的字段一律沿用草稿箱当前值（保住后台人工改过的标题/摘要/封面/作者）
        item = (get_draft(token, args.update_media_id).get("news_item") or [{}])[0]
        article = {
            "article_type": "news",
            "title": (args.title or item.get("title", ""))[:MAX_TITLE],
            "author": (args.author or item.get("author", ""))[:MAX_AUTHOR],
            "digest": (args.digest or item.get("digest", ""))[:MAX_DIGEST],
            "content": content,
            "content_source_url": args.source_url or item.get("content_source_url", ""),
            "thumb_media_id": item.get("thumb_media_id", ""),
            "need_open_comment": item.get("need_open_comment", 0),
            "only_fans_can_comment": item.get("only_fans_can_comment", 0),
        }
        if args.cover:
            print("· 上传新封面 …")
            article["thumb_media_id"] = upload_thumb(token, args.cover.read_bytes(), args.cover.name)
        elif not article["thumb_media_id"]:
            if first_bytes is not None:
                print("· 草稿无封面，用正文首图补 …")
                article["thumb_media_id"] = upload_thumb(token, first_bytes, first_name)
            else:
                raise WeChatError("草稿没有封面且正文无可上传图片，请用 --cover 指定")
    else:
        article = {
            "article_type": "news",
            "title": title[:MAX_TITLE],
            "author": args.author[:MAX_AUTHOR],
            "digest": (args.digest or auto_digest)[:MAX_DIGEST],
            "content": content,
            "content_source_url": args.source_url,
        }
        print("· 上传封面 …")
        if args.cover:
            article["thumb_media_id"] = upload_thumb(token, args.cover.read_bytes(), args.cover.name)
        elif first_bytes is not None:
            article["thumb_media_id"] = upload_thumb(token, first_bytes, first_name)
            print("  （未指定 --cover，已用正文首图作封面）")
        else:
            raise WeChatError("没有可用封面：正文没有可上传的图片，请用 --cover 指定一张")
        article["need_open_comment"] = 0
        article["only_fans_can_comment"] = 0

    _validate_metadata(article["title"], article["author"], article["digest"], content)

    if args.update_media_id:
        print("· 就地更新草稿（media_id 不变，不新建不删除）…")
        update_draft(token, args.update_media_id, 0, article)
        _record_baseline(key, args.update_media_id, token)
        media_id = args.update_media_id
        mode = "update"
    else:
        # 改稿红线闸①：台账加锁——已推送过的 html 禁止裸 add 覆盖
        if key in manifest and manifest[key].get("media_id"):
            prev = manifest[key]["media_id"]
            print("🛑 改稿红线：这篇源文件之前已经推送过草稿箱。")
            print(f"   现有草稿 media_id = {prev}")
            print("   修改已推送的文章必须增量更新（media_id 不变），禁止新建+删旧覆盖：")
            print(f"   python3 {Path(sys.argv[0]).name} {source.name} --update-media-id {prev}")
            print("   （后台若有人工修改，脚本会先备份并要求合并后再 --force）")
            return 2
        print("· 新增草稿 …")
        media_id = add_draft(token, article)
        _record_baseline(key, media_id, token)  # 立即回读登记基线，供后续人工改动检测
        mode = "push"

    # 回读核验（标题一致性）
    verified = get_draft(token, media_id)
    v_items = verified.get("news_item") or []
    if not v_items or v_items[0].get("title") != article["title"]:
        raise WeChatError("草稿回读标题与提交不一致，请人工到草稿箱复核。")

    print(f"\n✅ 已{'增量更新' if mode == 'update' else '进'}草稿箱。draft media_id = {media_id}（mode={mode}）")
    if mode == "update":
        print("   后台人工修改过的标题/摘要/封面已保留；被替换的旧正文备份在 draft-backups/。")
    else:
        print(f"   台账已登记：之后改这篇必须用 --update-media-id {media_id}，不要重新裸 add。")
    print("   到 mp.weixin.qq.com 后台「草稿箱」预览/调封面后，人工发布。")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (WeChatError, requests.RequestException) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
