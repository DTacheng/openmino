# 草稿箱一键上传工具(`scripts/`)

本目录提供统一的微信草稿箱推进脚本 `upload_to_draft.py`，支持两种输入：

| 输入类型 | 文件后缀 | 处理逻辑 |
|---|---|---|
| 已排版 HTML | `.html` / `.htm` | 直接解析，替换 base64/本地图片为 mmbiz URL，推进草稿箱 |
| Markdown 源稿 | `.md` | 先渲染为基础 HTML，替换图片，推进草稿箱 |

无论哪种输入，最终都走同一套「排版 → 换图 → 上传封面 → draft/add → 回读核验」链路。

## 共性安全原则

- **都不自动群发/发布**。脚本只做到「进草稿箱」为止；最终"发布/群发给粉丝"由人工在
  `mp.weixin.qq.com` 后台或手机【公众号助手】点（个人/未认证号 API 本就不开放群发）。
- 满足 CLAUDE.md 红线：默认只到草稿箱；正式群发需阿成明确确认。
- 正文图片：走微信图床换 mmbiz URL（`draft/add` 的 `content` 会过滤 base64/外链图）。
- 封面：上传永久素材拿 `thumb_media_id`。
- 凭证走**环境变量或 Windows 注册表** `WECHAT_MP_APPID` / `WECHAT_MP_APPSECRET`，
  **不要把 AppSecret 写进文件或 git**。旧命名 `WX_APPID` / `WX_APPSECRET` 仍兼容。

## 前置（这台电脑第一次用）

```bash
# 1. 装依赖
python -m pip install requests beautifulsoup4 markdown pillow

# 2. 设凭证（二选一）
#    方式A —— 临时（仅当前 shell）：export / $env:
#    方式B —— 持久化到 Windows 注册表（推荐，以后不用再设，脚本会自动读）：
[Environment]::SetEnvironmentVariable("WECHAT_MP_APPID","wx...","User")
[Environment]::SetEnvironmentVariable("WECHAT_MP_APPSECRET","...","User")

# 3. 把本机公网出口 IP 加进 公众号后台→开发→基本配置→IP白名单
#    （未加会出现 40164，脚本会提示）
```

**脚本读凭据顺序**：环境变量 `WECHAT_MP_APPID`/`WECHAT_MP_APPSECRET` → Windows 注册表 `HKCU\Environment` → 旧命名 `WX_APPID`/`WX_APPSECRET` → 交互式输入。持久化到注册表后，本机任意新进程直接一条命令即可推送，无需中转/每次设环境变量。

## 用法：`upload_to_draft.py`

### Markdown → 草稿箱

```bash
python capabilities/wechat-article-layout-pitfalls/scripts/upload_to_draft.py \
  content/法律元力-新媒体/xxx/draft.md \
  --title "文章标题" \
  --author "作者" \
  --cover content/.../封面.jpg
```

### 已排版 HTML → 草稿箱

```bash
python capabilities/wechat-article-layout-pitfalls/scripts/upload_to_draft.py \
  content/xxx/article.html \
  --title "文章标题" \
  --author "作者" \
  --cover content/.../封面.jpg
```

要点：
- Markdown 会自动提取标题/摘要；`### 摘要`、`## 配图建议`、`## 发布审核提示`、`> 备选标题` 等内部块会被剔除，不进正文。
- HTML 源稿必须显式提供 `--title`。
- 正文本地相对路径图片（如 `![x](./img.jpg)`）或 base64 图片会被自动上传为 mmbiz URL。

### 改稿红线：已推送草稿只能增量更新（0.7.0 起脚本强制）

已经推进草稿箱的文章，再改**必须**用 `--update-media-id <id>` 增量更新（media_id 不变、不新建不删除），**严禁**裸 `add` 全量重推（会把后台手动改过的头图/标题/摘要/文字全部删掉且不恢复）：

```bash
python upload_to_draft.py article.html --update-media-id <media_id>
```

三道安全闸拦手滑：
1. 已推过的源文件再裸 `add` → 按台账拒绝（exit 2）；
2. 更新前自动备份草稿箱当前内容到 `draft-backups/`；
3. 检测到草稿被后台人工改过 → 默认拒绝（exit 2），须先把人工版 diff 出来合并进本地源，再带 `--force` 重推。

增量更新时不传 `--title/--author/--digest/--cover/--source-url` 会沿用草稿箱当前值（后台改过的标题/摘要/封面天然保留）。不确定草稿状态时，先 `--update-media-id <id> --export-current`（只备份+登记基线、不推送）。

## 常见错误码

| 码 | 含义 / 处理 |
|---|---|
| `40164` | IP 不在白名单 → 后台把本机出口 IP 加进 IP 白名单 |
| `48001` | 个别个人/未认证号直连会遇到（平台口径不一致）→ 后台接口权限确认草稿/素材项，或改走第三方 authorizer access_token，或后台反馈 |
| `40013` / `40125` | AppID / AppSecret 不对 |
| `45009` | 超天级调用频率，次日恢复 |
| `40005` / `40009` | 图片格式 / 大小超限（仅 jpg/png 且 <1MB） |

## 历史备注

- 2026-08-14 前本目录曾有 `wechat_draft.py`（Markdown → 草稿箱）和 `upload_to_draft.py`（HTML → 草稿箱）两个脚本。实践中所有公众号推文都应走排版稿，为避免混淆、统一入口，已将 Markdown 渲染能力并入 `upload_to_draft.py`，并删除 `wechat_draft.py`。
- 2026-08-14 真机验证通过：凭据持久化到注册表后，`upload_to_draft.py` 可单条命令完成 stable_token → 正文换图 → 封面上传 → draft/add → 回读核验。本机出口 IP 已在白名单。
