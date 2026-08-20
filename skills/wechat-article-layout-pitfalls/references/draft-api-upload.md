# 一键上传到公众号草稿箱（draft API）

**核心结论（2026-06-03 核实官方文档 + 实测口径）：** 公众号草稿箱接口 `draft/add` 是真实可用的，能把一篇 HTML 文章直接推进后台「草稿箱」，省掉手动 Ctrl+V。**关于谁能用、和一个大坑：**

1. **账号权限（别写死"只有认证号能用"）：**
   - **创建草稿这一步，个人/未认证订阅号实测可行**。135 / 壹伴等第三方工具能把文章同步进个人号草稿箱，走的就是 `draft/add`。
   - **2025-07 被回收的是 API 自动"群发/发布"（freepublish）能力**——"直接推给粉丝"那一步，对个人主体/未认证号关闭。**创建草稿 ≠ 发布**，两件事分开。早期 skill 把"草稿 API"整体当死路、说"个人号一律走不通"是**把这两步混为一谈了，已纠正**。
   - 官方口径不统一：少数个人号**直连** `draft/add` 报 `48001 api unauthorized`，而开发者平台又显示有权限——平台侧不一致。遇到就按下面错误码表的 48001 处理。
   - **不变的是最后一步**：个人/未认证号的"发布/群发给粉丝"必须人工在手机端【公众号助手】点，API 不代劳。本 skill 脚本只做到草稿箱为止，正好落在个人号能用的范围内。
2. **大坑 —— 正文里的图片不能用 base64**。`draft/add` 的 `content` 字段虽然支持 HTML，但官方明确："涉及图片 url 必须来源'上传图文消息内的图片'接口获取，外部图片 url 将被过滤"。**base64 data URI 会被直接过滤掉**。所以草稿 API 工作流和手动粘贴工作流的图片处理是相反的：手动粘贴只认 base64，草稿 API 只认微信图床 URL。

> 两条工作流并存：
> - **手动粘贴**（本 skill 主线）：图片走 base64，Ctrl+V 进编辑器。任何账号都能用。
> - **草稿 API**（本文）：图片先传微信换 URL，一键进草稿箱。个人/未认证号通常也能用（至少创建草稿），需要一台能跑脚本、IP 可加白名单的机器。

---

## 一、前置配置（公众号后台，一次性）

1. **账号类型**：个人/未认证订阅号通常也能创建草稿（见上文「核心结论」）。若直连报 48001，再考虑认证或走第三方授权。注意"发布/群发给粉丝"个人号仍需手机端手动点。
2. **拿 AppID / AppSecret**：mp.weixin.qq.com →「设置与开发 → 开发 → 基本配置」。AppSecret 只在重置时显示一次，妥善保存。
3. **配 IP 白名单**：同页「公众号开发信息 → IP 白名单」，把**运行脚本那台机器的公网出口 IP** 加进去。不加的话 `stable_token` 会报 `40164 invalid ip not in whitelist`。
   - 本地家用宽带 IP 会变，建议用固定公网 IP 的云服务器；或每次跑前更新白名单。
4. **草稿箱开关**：新号若调 `draft/add` 报错提示草稿箱未开启，调一次「草稿箱开关设置」`draft/switch` 打开（多数已认证号默认已开）。

---

## 二、完整接口链路

四步，全部在服务器端用 HTTPS 调用（不能在前端/网页直接调，access_token 一旦泄露等于账号被接管）。

### 步骤 1：获取 access_token（用稳定版）

```
POST https://api.weixin.qq.com/cgi-bin/stable_token
Body(JSON): {"grant_type":"client_credential","appid":"APPID","secret":"APPSECRET"}
→ {"access_token":"...", "expires_in":7200}
```

- 有效期 7200 秒，**自己缓存复用**，别每次都拉（强制刷新每天限 20 次）。
- 推荐 `stable_token` 而非老的 `cgi-bin/token`，两者隔离、更稳。

### 步骤 2：正文图片逐张上传，换成微信 URL（最关键）

正文 HTML 里每个 `<img>`（base64 / 本地文件 / 外链都一样）都要先传到微信图床：

```
POST https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=ACCESS_TOKEN
Body(form-data): media=@图片文件
→ {"url":"https://mmbiz.qpic.cn/XXXX", "errcode":0}
```

- **只支持 jpg/png，大小必须 < 1MB**（这是原图上限——API 链路没有"base64 ≤135KB"的限制，那是手动粘贴链路的坑。走草稿 API 时图片按清晰度需要准备，别按 135KB 压，否则会糊）。
- 不占用素材库 10 万张配额。
- 把返回的 `url` 替换回 HTML 里对应 `<img src="...">`。

### 步骤 3：封面图上传为永久素材，拿 thumb_media_id

`article_type=news`（普通图文）的封面 `thumb_media_id` **必填**，且必须是**永久** MediaID：

```
POST https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=ACCESS_TOKEN&type=image
Body(form-data): media=@封面图.jpg
→ {"media_id":"...", "url":"..."}
```

- 这个 `media_id` 才能填进 `thumb_media_id`。注意它**会**占用永久素材配额（步骤 2 的 uploadimg 不占）。
- 封面图建议单独准备一张（1:1 或 2.35:1），没有就拿正文首图。

### 步骤 4：新增草稿

```
POST https://api.weixin.qq.com/cgi-bin/draft/add?access_token=ACCESS_TOKEN
Body(JSON):
{
  "articles": [{
    "article_type": "news",
    "title": "标题（≤32字）",
    "author": "作者（≤16字）",
    "digest": "摘要（≤128字，留空则抓正文前54字）",
    "content": "<整篇 HTML，图片已是 mmbiz URL>",
    "content_source_url": "阅读原文链接（可选）",
    "thumb_media_id": "步骤3拿到的封面 media_id",
    "need_open_comment": 0,
    "only_fans_can_comment": 0
  }]
}
→ {"media_id":"草稿的 media_id"}
```

成功后到 mp.weixin.qq.com 后台「草稿箱」就能看到这篇，可以再人工预览、调封面、群发/发布。

> **注意：草稿 API 只负责"进草稿箱"，不自动群发。** 真正推送给粉丝要么后台手动点发表，要么再调「发布草稿」`freepublish/submit`（认证订阅号每天群发次数仍受平台限制）。本 skill 的脚本只做到草稿箱为止——更安全，留人工最后一道关。

---

## 三、同一草稿上迭代：draft/get + draft/update（2026-08-14 实战新增）

**草稿不是一次性的。** 推进草稿箱后用户在后台手动改了内容、要求再调整排版时，**不要新建草稿，也不要从本地 article.html 全量重推**（会覆盖用户在后台的手动修改）。正确链路：

1. **draft/get 拉回当前线上内容**（含用户手改后的版本）：

```
POST https://api.weixin.qq.com/cgi-bin/draft/get?access_token=ACCESS_TOKEN
Body(JSON): {"media_id":"草稿 media_id"}
→ {"news_item":[{title, author, digest, content, thumb_media_id, ...}]}
```

2. **在拉回的 HTML 上做外科手术**：只改要改的元素，其余原样保留。
3. **draft/update 写回同一 media_id**，不产生新草稿：

```
POST https://api.weixin.qq.com/cgi-bin/draft/update?access_token=ACCESS_TOKEN
Body(JSON): {"media_id":"...", "index":0, "articles":{...}}
```

`articles` 的字段要**带全**（title / author / digest / content / content_source_url / thumb_media_id / need_open_comment / only_fans_can_comment）——直接从 draft/get 的响应里原样取回、只替换 content 即可。

4. **再 draft/get 回读核验**，确认修改生效且其他内容没动。

`upload_to_draft.py --update-media-id <id>` 封装了这条链路。

### 三个实测坑（今天各踩一次）

- **响应编码**：`draft/get` 返回可能不是 UTF-8，直接 `.json()` 会乱码导致标题核验失败。先 `resp.encoding = resp.apparent_encoding` 再解析。
- **图片在 `data-src`**：回读回来的 content 里，`<img>` 的 URL 在 `data-src` 属性（mmbiz URL 带 `/640?from=appmsg`），`src` 为空。解析/比对时读 `data-src`；draft/update 把 data-src 格式原样写回是可用的。
- **校验顺序**：含 base64 的 HTML 会先撑爆 1MB 体积校验——**必须先换图（base64→mmbiz）再校验 content 体积**，顺序反了会误报。

### 后台手动编辑的大坑：拖图会产生副本、吃掉文字

用户在网页版编辑器里**拖动图片调位置**时，编辑器可能把图片副本嵌进段落文字的 `<span>` 里，并把文字从中间截断吃掉。症状极具迷惑性：**图一张不少，但顺序错乱、文字缺段**（例如图注被截成"密钥不写入项[图]通过"，整句"插件以 .tgz 包分发并带 SHA-256 校验…"消失）。

- **诊断**：draft/get 拉回后按文档顺序 dump 顶层元素（p / img / table 各是什么），和用户截图逐一对位，别凭猜。
- **修法**：删掉嵌在文字 span 里的重复 `<img>`，补回被吃掉的文字（对照本地 article.html 的原句），其余不动。
- **预防**：提醒用户后台微调尽量只改文字；挪图后检查相邻段落文字是否完整。

### 草稿版本清理：batchget + delete（2026-08-14 实战新增）

一篇文章反复推送/改题重推会在草稿箱堆出一串同名草稿。定稿后清理旧版：

1. `POST draft/batchget`，Body `{"offset":0,"count":20,"no_content":1}` 列出全部草稿（`no_content:1` 只回元数据，快）；
2. 按**标题匹配 + update_time** 核对，确认哪些是本篇旧版（别误删别的文章的草稿；media_id 以此接口返回的完整值为准）；
3. `POST draft/delete`，Body `{"media_id":"..."}` 逐个删除（返回 `errcode:0` 即成功，**不可恢复**）；
4. 再 batchget 复核只剩最终版。

---

## 四、content 字段的约束（写 HTML 时注意）

- `content` 支持 HTML 标签，但 **JS 会被去除**。
- **总大小 < 1MB（微信官方正文体积上限），没有单独的字符数上限**。换图后正文体积通常很小，反而是没替换干净的 base64 会撑爆 1MB。实测（2026-08-20）：38,102 字符（46.6KB）正文 draft/add 照收、回读完整；脚本旧版自设的 20,000 字符校验并非微信政策，0.6.1 已移除。
- 图片 URL **只认微信图床域名**（mmbiz.qpic.cn 等），外链/base64 一律过滤 → 步骤 2 必须做。
- 草稿 API 的 content 会经过一次服务端清洗，清洗规则与"编辑器粘贴白名单"**不完全相同**。本 skill 的 HTML 排版规则（table 容器、inline style、bgcolor 双写等）依然适用且更保险。
- **服务端清洗实证（2026-08-14 证券合规稿）**：早期版本脚本曾把整份 HTML 文档（含 DOCTYPE/html/head/meta/title/body）再包一层 `<body>` 提交，回读发现服务端把文档级标签**全部剥掉**，存储层是干净的正文片段，`<title>` 文本也不会泄漏成游离文字。结论：① 这解释了"为什么脏内容也能推成功"；② 但提交净内容仍是契约，脚本已修复为"content 已含 `<body>` 时原样写入"（防御性，不依赖未承诺的清洗行为）；③ 该问题**不是**排版/图片丢失的根因，丢图丢排版先查外链图、Markdown 路径属性清空、SVG 上传失败这三条线。
- **标题 32 字符硬截断**：`draft/add` 的 title 上限 32 字符（含标点），脚本按 `title[:32]` 静默截断、无报错。定稿标题必须 ≤32 字验收；推送后回读做 title **全等比对**，不一致立即改题重推（2026-08-14 证券合规稿 33 字标题被截掉末字"体"，靠回读才发现）。
- **inline `<svg>` 经 draft API 是否保留没有官方保证**（编辑器手动粘贴是确认零过滤的，但接口清洗链路不同）。稳妥做法：走草稿 API 时把 SVG 先栅格化成 PNG（≤1MB）当普通图片走步骤 2；需要保留 SVG 动画就回退到手动粘贴工作流。
- **mmbiz 防盗链**：回读版 content 里的 mmbiz 图床 URL 有 Referer 校验，本地用浏览器/Playwright 打开预览时图片必裂——这是预期行为，不代表草稿坏了。**预览排版要用本地路径版 HTML 截图**，不要用回读版。

---

## 五、常见错误码

| 错误码 | 含义 | 处理 |
|---|---|---|
| 40164 | IP 不在白名单 | 把出口 IP 加进后台 IP 白名单 |
| 48001 | api unauthorized / 无此接口权限 | 个别个人号直连会遇到（平台口径不一致）。①后台「接口权限」确认草稿/素材项；②改走第三方平台授权 authorizer_access_token；③后台反馈申诉。不代表所有个人号都不能用 |
| 40013 | invalid appid | 检查 AppID |
| 40125 | invalid appsecret | 检查 AppSecret，必要时后台重置 |
| 45009 | 超天级调用频率 | 次日恢复，或调 clear_quota |
| 40005 / 40009 | 图片格式不对 / 尺寸太大 | uploadimg 只收 jpg/png 且 <1MB |
| 53404~53406 | 带货/商品相关 | 与图文上传无关，检查是否误传 product_info |

---

## 六、配套脚本

`scripts/upload_to_draft.py` —— 唯一入口，支持两种输入：已排版 `.html`（直接解析换图）和 `.md`（先渲染为基础 HTML）。自动完成步骤 1–4：取 token（带本地缓存）、把 base64 / 本地图片逐张 uploadimg 换 URL、上传封面拿 thumb_media_id、调 draft/add，最后回读核验并打印草稿 media_id。加 `--update-media-id <id>` 则改为更新已有草稿（走本文「三」的迭代链路）。用法见脚本头部注释与 `scripts/README.md`。

凭证通过环境变量或 Windows 注册表传入，**不要把 AppSecret 写进代码或提交到 git**：

```bash
export WECHAT_MP_APPID=wx......
export WECHAT_MP_APPSECRET=........
python3 scripts/upload_to_draft.py 13_xxx_公众号可粘贴版.html --title "标题" --author "作者" --cover 封面.jpg
```

读凭据顺序：环境变量 `WECHAT_MP_APPID`/`WECHAT_MP_APPSECRET` → 注册表 `HKCU\Environment` → 旧命名 `WX_APPID`/`WX_APPSECRET`（兼容）→ 交互输入。

---

## 七、来源

- 新增草稿 draft/add：https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html
- 获取草稿 draft/get：https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_get.html
- 更新草稿 draft/update：https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_update.html
- 上传发表内容中的图片 uploadimg：https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_uploadimage.html
- 获取稳定版 access_token：https://developers.weixin.qq.com/doc/subscription/api/base/api_getstableaccesstoken.html
- 账号权限相关社区讨论（口径不一，含个人号直连 48001 与第三方授权可用的案例）：https://developers.weixin.qq.com/community/minihome/doc/000a80660141289144b4b9d4b6bc00
