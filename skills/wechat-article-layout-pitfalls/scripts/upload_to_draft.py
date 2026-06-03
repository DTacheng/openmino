#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键把公众号 HTML 推进草稿箱（draft/add）。

前提：
  1. 创建草稿这一步个人/未认证订阅号通常也能用（第三方工具就是走这条接口）。
     2025-07 被回收的是 API 自动"群发/发布"(freepublish)，不是创建草稿；个人号最后
     发布给粉丝仍需手机端【公众号助手】手动点。个别号直连报 48001 见文末错误码提示。
  2. 运行本脚本这台机器的公网出口 IP 已加入「公众号后台 → 开发 → 基本配置 → IP 白名单」。
  3. 凭证通过环境变量传入（不要把 AppSecret 写进代码或提交 git）：
        export WX_APPID=wx......
        export WX_APPSECRET=........

用法：
    python3 upload_to_draft.py article_公众号可粘贴版.html \
        --title "标题（≤32字）" \
        --author "作者（≤16字）" \
        --digest "摘要（可选，≤128字）" \
        --cover 封面.jpg \
        --source-url "https://阅读原文（可选）"

说明：
  - 正文里的 <img>（base64 / 本地文件路径）会被逐张上传到微信图床（uploadimg）换成 mmbiz URL，
    因为 draft/add 的 content 会过滤掉 base64 和外链图片。
  - --cover 不传则取正文第一张图片当封面。封面会上传为永久素材拿 thumb_media_id。
  - 已是 http(s)://mmbiz... 的图片原样保留，不重复上传。
  - access_token 缓存在 .wx_token_cache.json，有效期内复用。
  - 脚本只做到「进草稿箱」为止，不自动群发——最后一步留人工在后台确认。

依赖：requests, beautifulsoup4, pillow
    pip install requests beautifulsoup4 pillow
"""

import argparse
import base64
import io
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

API = "https://api.weixin.qq.com/cgi-bin"
TOKEN_CACHE = Path(".wx_token_cache.json")
MMBIZ_HOSTS = ("mmbiz.qpic.cn", "mmbiz.qlogo.cn")


# ---------- access_token（带本地缓存） ----------
def get_access_token(appid: str, secret: str) -> str:
    if TOKEN_CACHE.exists():
        try:
            c = json.loads(TOKEN_CACHE.read_text())
            if c.get("appid") == appid and c.get("expire_at", 0) - 120 > time.time():
                return c["access_token"]
        except Exception:
            pass
    r = requests.post(
        f"{API}/stable_token",
        json={"grant_type": "client_credential", "appid": appid, "secret": secret},
        timeout=20,
    ).json()
    if "access_token" not in r:
        raise SystemExit(_explain(r, "获取 access_token 失败"))
    TOKEN_CACHE.write_text(json.dumps({
        "appid": appid,
        "access_token": r["access_token"],
        "expire_at": time.time() + r.get("expires_in", 7200),
    }))
    return r["access_token"]


# ---------- 图片字节准备：转 jpg/png 且 < 1MB ----------
def _normalize_image(raw: bytes, fallback_name: str) -> tuple[bytes, str]:
    """微信 uploadimg 只收 jpg/png 且 <1MB。返回 (bytes, filename)。"""
    if not HAS_PIL:
        # 没装 PIL 就原样上传，由微信校验
        return raw, fallback_name
    im = Image.open(io.BytesIO(raw))
    fmt = (im.format or "").upper()
    if fmt not in ("JPEG", "PNG"):
        im = im.convert("RGB")
        fmt = "JPEG"
    # 超 1MB 或非 jpg/png：重存为 jpg，必要时降质量/缩尺寸
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
        return None  # 外链由调用方决定是否抓取；这里跳过
    p = (html_dir / src).resolve()
    if p.exists():
        return p.read_bytes()
    return None


# ---------- 上传正文图片，换 URL ----------
def upload_content_image(token: str, raw: bytes, name: str) -> str:
    data, fname = _normalize_image(raw, name)
    files = {"media": (fname, data, "image/jpeg" if fname.endswith("jpg") else "image/png")}
    r = requests.post(f"{API}/media/uploadimg", params={"access_token": token},
                      files=files, timeout=60).json()
    if r.get("errcode", 0) != 0 or "url" not in r:
        raise SystemExit(_explain(r, f"uploadimg 失败（{name}）"))
    return r["url"]


# ---------- 上传封面为永久素材，拿 thumb_media_id ----------
def upload_thumb(token: str, raw: bytes, name: str) -> str:
    data, fname = _normalize_image(raw, name)
    files = {"media": (fname, data, "image/jpeg" if fname.endswith("jpg") else "image/png")}
    r = requests.post(f"{API}/material/add_material",
                      params={"access_token": token, "type": "image"},
                      files=files, timeout=60).json()
    if "media_id" not in r:
        raise SystemExit(_explain(r, "封面上传为永久素材失败"))
    return r["media_id"]


# ---------- 处理整篇 HTML ----------
def process_html(token: str, html_path: Path) -> tuple[str, bytes | None, str | None]:
    """返回 (替换好图片URL的HTML, 首图bytes, 首图name)。首图用于无 --cover 时做封面。"""
    html_dir = html_path.parent
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    first_img_bytes, first_img_name = None, None
    for i, img in enumerate(soup.find_all("img")):
        src = img.get("src", "")
        if any(h in src for h in MMBIZ_HOSTS):
            continue  # 已是微信图床，跳过
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
    # 只取 body 内层 HTML 作为 content（草稿正文不需要 <html>/<head>）
    body = soup.body or soup
    content = body.decode_contents() if hasattr(body, "decode_contents") else str(soup)
    return content, first_img_bytes, first_img_name


def add_draft(token: str, article: dict) -> str:
    payload = json.dumps({"articles": [article]}, ensure_ascii=False).encode("utf-8")
    r = requests.post(f"{API}/draft/add", params={"access_token": token},
                      data=payload, timeout=60).json()
    if "media_id" not in r:
        raise SystemExit(_explain(r, "draft/add 失败"))
    return r["media_id"]


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
    }
    extra = f"\n  → {tips[code]}" if code in tips else ""
    return f"{prefix}：{resp}{extra}"


def main():
    ap = argparse.ArgumentParser(description="一键把公众号 HTML 推进草稿箱")
    ap.add_argument("html", help="_公众号可粘贴版.html 路径")
    ap.add_argument("--title", required=True, help="标题（≤32字）")
    ap.add_argument("--author", default="", help="作者（≤16字）")
    ap.add_argument("--digest", default="", help="摘要（≤128字，留空抓正文前54字）")
    ap.add_argument("--cover", default=None, help="封面图路径（不传则取正文首图）")
    ap.add_argument("--source-url", default="", help="阅读原文链接（可选）")
    args = ap.parse_args()

    appid = os.environ.get("WX_APPID")
    secret = os.environ.get("WX_APPSECRET")
    if not appid or not secret:
        raise SystemExit("请先 export WX_APPID 和 WX_APPSECRET 环境变量")

    html_path = Path(args.html)
    if not html_path.exists():
        raise SystemExit(f"找不到文件：{html_path}")

    print("· 取 access_token …")
    token = get_access_token(appid, secret)

    print("· 处理正文图片 …")
    content, first_bytes, first_name = process_html(token, html_path)
    if len(content.encode("utf-8")) > 1_000_000:
        raise SystemExit("正文超过 1MB（很可能有 base64 没换干净），请检查")

    print("· 上传封面 …")
    if args.cover:
        cover_raw = Path(args.cover).read_bytes()
        thumb_id = upload_thumb(token, cover_raw, Path(args.cover).name)
    elif first_bytes is not None:
        thumb_id = upload_thumb(token, first_bytes, first_name)
        print("  （未指定 --cover，已用正文首图作封面）")
    else:
        raise SystemExit("没有可用封面：正文没有可上传的图片，请用 --cover 指定一张")

    article = {
        "article_type": "news",
        "title": args.title[:32],
        "author": args.author[:16],
        "digest": args.digest[:128],
        "content": content,
        "content_source_url": args.source_url,
        "thumb_media_id": thumb_id,
        "need_open_comment": 0,
        "only_fans_can_comment": 0,
    }

    print("· 新增草稿 …")
    media_id = add_draft(token, article)
    print(f"\n✅ 已进草稿箱。draft media_id = {media_id}")
    print("   到 mp.weixin.qq.com 后台「草稿箱」预览、调封面、再人工群发/发布。")


if __name__ == "__main__":
    main()
