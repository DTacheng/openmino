---
name: wechat-article-layout-pitfalls
description: 微信公众号推文 HTML/SVG 排版避坑速查 + 草稿箱一键上传。当用户要写公众号推文、生成 HTML 排版、嵌入 SVG 插图、从已发布文章复用素材、或想通过 API 一键上传到公众号草稿箱时使用——确保 HTML 粘贴进 mp.weixin.qq.com 编辑器后样式不丢、SVG 动画不丢、正文左右对齐、图片能带得过去。覆盖 ProseMirror 编辑器的粘贴白名单、SVG/SMIL 兼容性、base64 图片要求、二次复用陷阱、以及 draft/add 草稿接口的配置与账号门槛。
author: 常成（律川 Planet）
version: "0.6.1"
license: CC BY-NC 4.0
---

# 微信公众号推文排版避坑

公众号编辑器（mp.weixin.qq.com 的 ProseMirror）对粘贴的 HTML 不是任意接受的，但坑分布与多数人想象的相反——它**比想象的宽容**（连 SVG + SMIL 动画都收），但**特定标签和 CSS 会被静默丢弃**、**HTML 属性会被忽略**、**嵌套 table 的尺寸会被强行重排**。这个 skill 是 2026-05-26 首次完整实测、2026-05-27 律川 Planet 实战发稿过程沉淀、2026-05-28 Playwright 编辑器实测纠正 keep-all、2026-06 回填法律元力 / Lawvable / MyAgents 系列 13 篇早期实战 HTML 层踩坑的避坑清单。

## 何时启用

写公众号推文 HTML 之前 → 启用本 skill 的「粘贴前清单」做 lint。
写完之后 → 按清单核对一遍再交付。
用户报"粘贴进编辑器样式丢了 / SVG 没动画 / 图片显示不出来" → 直接对照 references/ 排查。

## 公众号写作的两条工作流（按账号类型选）

### A. 手动粘贴（任何账号都能用，主线）

1. **本地写 HTML** —— 严格按白名单标签和内联 CSS（见 `references/html-paste-whitelist.md`），图片走 **base64**
2. **打开 mp.weixin.qq.com 编辑器** —— 新建文章
3. **Ctrl+V 直接粘贴整段 HTML** —— ProseMirror 会做白名单过滤
4. **保存草稿后再预览** —— 编辑器内的视觉不等于手机端的视觉
5. **必要时用 Playwright 自动化辅助测试** —— 不是为了自动发布，是为了快速验证一段 HTML 在编辑器里的渲染结果

### B. 草稿箱 API 一键上传（个人/未认证号通常也能用，免手动粘贴）

统一使用 `scripts/upload_to_draft.py`。它支持两种输入：

- **已排版 HTML（`.html`）**：直接解析，把 base64/本地图片上传到微信图床换成 mmbiz URL，传封面，调 `draft/add`，回读核验。
- **Markdown 源稿（`.md`）**：先渲染为基础 HTML，再走同样的换图 → 传封面 → `draft/add` → 回读链路。

**关于账号权限（2026-06 核实，别再写死"只有认证号能用"）：**

- **创建草稿（draft/add）个人/未认证订阅号实测可行**——这正是 135 / 壹伴等第三方工具能把文章同步进个人号草稿箱的原因；它们走的就是这条接口。
- **2025-07 回收的是 API 自动"群发/发布"（freepublish）能力**——即"直接推送给粉丝"那一步，对个人主体/未认证号关闭。**创建草稿不等于发布**，两者是分开的。
- 官方口径不统一：少数个人号**直连** `draft/add` 会遇到 `48001 api unauthorized`，而开发者平台又显示有权限——属于平台侧不一致。遇到 48001 的解法：① 在后台「设置与开发→开发→接口权限」确认草稿/素材权限项；② 改走第三方平台授权（`authorizer_access_token`）路径（第三方工具就是这么绕过去的）；③ 后台「反馈」申诉。
- **无论哪种账号，最后"发布/群发给粉丝"都得人工在手机端【公众号助手】点**——API 不替个人号自动群发。本 skill 的脚本也只做到草稿箱为止。

**关键差异：草稿 API 的正文图片不能用 base64**（会被过滤），`upload_to_draft.py` 会内部调用 `media/uploadimg` 把每张图换成 mmbiz URL。需要一台能跑脚本、公网出口 IP 可加进后台 IP 白名单的机器。完整配置和接口链路见 `references/draft-api-upload.md`。

凭证统一读取 `WECHAT_MP_APPID` / `WECHAT_MP_APPSECRET`（环境变量 → Windows 注册表 `HKCU\Environment` → 旧命名 `WX_APPID`/`WX_APPSECRET` 兼容 → 交互输入）。

**标题 32 字符硬上限（2026-08-14 实战新增）：** 脚本按 `title[:32]` 静默截断，33 字标题推送后会丢末字且无任何报错。定稿标题必须 ≤32 字（含标点）验收；推送后回读必须做 `title` **全等比对**（不是"看起来差不多"），不一致立即改题重推。

**同一草稿上迭代（2026-08-14 实战新增，重要）：** 推进草稿箱后用户在后台手动改过内容、再要求调整时——

- ❌ **不要新建草稿**（草稿箱里会堆出一串同名草稿），也❌ **不要从本地 article.html 全量重推**（会覆盖用户在后台的手动修改）
- ✅ 走 `draft/get` 拉回线上当前内容 → 在拉回的 HTML 上**外科手术式**只改目标元素 → `draft/update` 写回同一 media_id → 再 `draft/get` 回读核验。脚本用 `--update-media-id <id>`
- ⚠️ **后台编辑器拖图坑**：用户在网页版编辑器拖动图片调位置时，编辑器会把图片副本嵌进段落文字里、并把原文从中间截断吃掉——症状是"图一张不少，但顺序乱、文字缺段"。诊断靠 draft/get 拉回后按顺序 dump 元素（p/img/table）和用户截图对位；修法是删掉嵌在文字里的重复 `<img>`、补回被吃掉的文字。详见 `references/draft-api-upload.md` 第三节
- ⚠️ draft/get 两个解析坑：响应可能非 UTF-8（用 `resp.apparent_encoding` 解码）；图片 URL 在 `data-src`，`src` 为空

不要尝试这些路径，会浪费时间：
- 秀米 / 壹伴 / 135 编辑器同步（做排版可以，但对 `<table>` 自定义结构和复杂 SVG 支持反而更差；它们的"同步到草稿箱"本质就是帮你调 draft/add）
- Markdown 直接导入（公众号当前没有官方 Markdown 入口；ProseMirror 没有源码模式）
- 指望用 API 自动**群发**给粉丝（个人/未认证号这一步被关，得手动点）

## 四类避坑速查

### 1. HTML 容器
- ❌ `<div>` 会被整体降级为 `<p>`，所有内联样式连带丢失
- ❌ `<figure>` 同 `<div>` 命运——图片包装不能用 figure，用 `<table>`
- ✅ 用单 cell `<table><tr><td style="...">` 当容器，背景色、圆角、padding 全保留
- ✅ 竖条装饰用 `border-left: Npx solid #xxx` 直接画在 td 上
- ❌ **HTML 属性 `<table border="0">` 不被认**——编辑器忽略此属性并自动给每个 table 加 1px 灰边
- ✅ 必须 inline `style="border:0;border-collapse:separate;"` 才能压住编辑器自加的灰边；带视觉边界的 td 用 `style="border:0;border-left:Npx solid #xxx;..."`（同属性后写胜出）
- ❌ **嵌套 `<table width="X%">` 的百分比宽度会被强制拉成 100%**——所有"几何对比图"（金字塔、对比柱、流程图）用嵌套 table 都会变等宽，必须改用 SVG（见第 3 项）
- ❌ `<body style="background:#XXX">` 不会均匀生效——部分元素吸到底色、部分没吸到，渲染会"花"。保持 body 默认白底，需要色块就在具体 td 上画
- ❌ CSS 变量 (`var(--brand)`) 和 class 选择器全部无效
- ✅ 所有样式必须**内联**写在 `style="..."` 里
- ❌ **不要用 CSS `width:100%`**——编辑器把它算成 720px 画布下的固定像素，塞到手机上每张卡片被挤成细条。满宽一律走 HTML 属性 `width="100%"`（`max-width:520px` 这种兜上限的可以留在 CSS）
- ✅ **`<section>` 是安全的带底色/带左竖条容器（2026-08-14 真机双层实测修正）**：经律川 Planet 账号真机验证，`<section>` 上的 `background-color`、`linear-gradient` 背景、`border-left` 竖条、`border-image:linear-gradient` 渐变竖条、`box-shadow` 双层阴影——粘贴归一化层 + 服务端保存回读层**全过、都不剥**。旧版"`<section>` 会剥底色、必须用 `<table bgcolor>` 双保险"的结论**作废**（当时只测了纯色 `background-color`，且是更早的编辑器版本）。`<table bgcolor>` 双保险写法仍可用但不必须；追求"官微视觉风格"（渐变卡片/左渐变条/阴影卡片）直接看 `wechat-visual-style` 组件库
- ✅ **要不要框子 = 要不要 bgcolor**：底色等于页面底色的自由段落（开篇/结尾）只用 `<section>` + `<p>`，**不要套 `<table>`**（同色 table 也会被编辑器描出一圈框）
- ✅ **卡片外层 `<section>` 统一 `padding:0 8px`**，与正文段落同一套水平缩进对齐；24px 叠加编辑器自带边距会被用户嫌"缩进太多、文章太窄"（2026-08-14 证券合规稿实战，阿成明确反馈后由 24px 改为 8px）；唯二例外是 full-bleed 的品牌色条和通铺的 hero/footer
- ❌ **进度条/评分条不要用内层 `<div style="background-color">`**（背景被剥成空格子）——让 `<td bgcolor>` 自己当色块，且必须填 `&nbsp;` + `font-size:0`（空 `<td>` 在手机端会塌掉），宽度用 `width="X%"` 属性
- ❌ **不用 `::before` / `::after` 等伪元素**（依赖 `<style>`，必丢）——圆形序号徽章用 `<span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:50%;">`，装饰引号用 `&ldquo;` + 定位 span 替代

### 2. 正文段落
- ✅ 正文 `<p>` 必须包含 `text-align: justify` —— 默认左对齐右侧参差不齐，中英文混排尤其丑
- ❌ **不要加 `word-break: keep-all`** —— 这是之前 0.2.0 版本的致命错误。`keep-all` 限制中文只在标点/空格处换行，导致 justify 时短行被过度拉伸，字间距稀疏不匀，效果很差（2026-05-28 Playwright 编辑器实测确认）
- ✅ **`word-break: normal`（CSS 默认值）就够用**——中文按字符自然换行，英文整词在空格处换行，英文长单词不会被截断
- ✅ 可选加 `overflow-wrap: break-word` 兜底——防极端超长不可断词（如 URL）撑破容器
- 推荐组合：`<p style="margin:...; text-align:justify;">`（最简，word-break 默认为 normal 即可）或 `<p style="margin:...; text-align:justify; word-break:normal; overflow-wrap:break-word;">`（显式安全版）
- 不适用于：标题、`<blockquote>`、卡片内 `<p>`、居中类小标签
- ❌ **列表不要在一个 `<td>` 里用 `<br/><br/>` 分隔多条 bullet**——WeChat 会把 `<td>` 开头的第一段 inline 内容单独套一层 `<p>`，导致**第一条**的标号被换行、和后面的条目错位
- ✅ **每条 bullet 用独立的 `<p>` 承载**（前面的条目 `margin:0 0 12px 0`、最后一条 `margin:0`），每条都是独立 block，WeChat 无从下手

### 3. SVG 插图（关键 — 多数人这里想错了）
- ✅ **公众号编辑器接受直接粘贴 SVG**，包括 SMIL `<animate>` / `<animateTransform>` 动画
- ✅ 服务端**零过滤** SVG，保存草稿/重新打开/发布后动画完整保留
- ✅ **SVG 是几何图表的逃生通道**：金字塔、对比柱、流程图、并联关系——HTML 嵌套 table 会被 editor 强制拉等宽，SVG 用 viewBox 坐标完全规避了这个问题。需要精确比例就用 SVG
- ⚠️ 但 SVG **必须遵守公众号 H5 WebView 的渲染限制**：禁用纯白底、禁用 filter、禁用 gradient、translate 陷阱等（见 `references/svg-pitfalls.md`）
- ⚠️ 不要尝试从已发布文章 copy SVG 二次复用——剪贴板对 inline SVG 的处理不可靠（见 `references/reuse-and-copy.md`）
- ⚠️ 不要重复造 SVG 生成轮子——已经有杨卫薪律师的 `svg-article-illustrator` 专门做这件事

### 4. 图片
- ❌ 本地路径 `<img src="./xxx.png">` 粘贴进编辑器后立刻失效
- ❌ 外链 `<img src="https://...">` 微信会拒抓非白名单域名
- ❌ `<img>` 上加 `box-shadow` 可能让整个 img 标签被丢——保持 img 的 style 干净（display/width/height/border 就够了）
- ✅ **唯一可靠路径：`<img src="data:image/png;base64,...">`** 或 `data:image/jpeg;base64,...`
- ⚠️ **实测安全线：base64 编码后 ≤135KB**（对应原图 ~100KB JPEG）——>150KB base64 在粘贴时常被静默吃掉。**注意此限只针对手动粘贴链路**；走草稿 API 时图片经 `uploadimg` 换 mmbiz URL，上限是原图 1MB——头图等要清晰的图按 1MB 准备即可，别按 135KB 压（会糊，2026-08-14 实战教训）
- ⚠️ 大图先用 PIL/Sharp 缩到 800px 宽再编码，肉眼差异极小但 base64 减半
- ⚠️ 整篇文章 HTML 过大（>几 MB）时编辑器粘贴会卡甚至崩，多图考虑分段粘贴

## 粘贴前必跑清单

逐条检查 `references/pre-paste-checklist.md`。

## 引用资料

- `references/html-paste-whitelist.md` —— 公众号 ProseMirror 实测保留的标签和 CSS 白名单
- `references/svg-pitfalls.md` —— SVG 在公众号的渲染约束（吸收杨卫薪律师 `svg-article-illustrator` 的避坑规则，MIT 协议）
- `references/pre-paste-checklist.md` —— 粘贴前 lint 清单
- `references/reuse-and-copy.md` —— 从已发布文章复用素材的陷阱与替代方案
- `references/draft-api-upload.md` —— 一键上传草稿箱（draft API）的配置、接口链路、账号门槛、base64 不可用的坑
- `scripts/upload_to_draft.py` —— 草稿箱一键上传脚本（认证账号用）

## 关联 Skill

- **`svg-article-illustrator`**（杨卫薪律师，MIT）—— 专门生成符合公众号规范的 SVG 配图，本 skill 不做生成只做 lint
- **`piclist-upload`**（杨卫薪律师，MIT）—— 图片自动上传到图床并替换链接

## 致谢

SVG 避坑规则核心吸收自杨卫薪律师 `svg-article-illustrator`（https://github.com/cat-xierluo/legal-skills，MIT License）。HTML/CSS 兼容性结论来自 2026-05-08 公众号 ProseMirror 编辑器粘贴实测和 2026-05-26 SVG 完整链路实测。0.2.0 新增的 4 个坑（figure / border 属性失效 / 嵌套 table 等宽 / body bg 不均）来自 2026-05-27 律川 Planet「钻石型团队」实战发稿。0.3.0 回填的 HTML 层细节坑（CSS width 手机端塌缩 / bgcolor 双保险 / 进度条 td 色块 / 同色段落不套 table / 卡片与正文对齐 / 列表独立 p / 伪元素禁用）来自 2026-04 法律元力 / Lawvable / MyAgents 系列 13 篇推文的早期实战沉淀。0.5.0 新增的草稿迭代链路（draft/get + draft/update 同一草稿外科手术）与后台编辑器拖图坑（拖图产生副本嵌进文字、吃掉原文）来自 2026-08-14 元典开放平台 DeepSeek Harness 插件稿实战。0.5.1 新增：外层 section 缩进由 24px 改为 8px（阿成实战反馈"缩进太多、文章太窄"）、标题 32 字符硬截断与回读全等校验、draft/add 服务端清洗文档级标签的实证、mmbiz 防盗链导致本地预览裂图、草稿版本清理链路（batchget/delete）——来自 2026-08-14 元典证券合规 MCP 稿实战。0.6.0 作废"`<section>` 会剥底色/左竖条"旧结论、白名单补 `border-image`/`box-shadow`/`linear-gradient on section` 三条——来自 2026-08-14 律川 Planet 账号真机双层实测（对戴桁宇《公众号排版组件库》争议元素逐项验证），并配套新增 `wechat-visual-style` 官微视觉组件库 skill。0.6.1 移除 `upload_to_draft.py` 自设的 20,000 字符正文校验（只保留微信官方 1MB 体积上限）——2026-08-20 刑事辩护全流程 Pro 版实测 38,102 字符正文 draft/add 照收、回读完整，证明字符线是脚本自设而非微信政策（阿成 2026-08-20 拍板放宽）。
