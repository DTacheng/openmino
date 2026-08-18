# CHANGELOG

## 0.6.0 (2026-08-14)

**作废"`<section>` 会剥底色/左竖条"旧结论 + 补齐渐变/阴影/border-image 白名单 + 新增官微视觉组件库 skill。**

此前 skill 长期断言"`<section style="background-color">` 在长块/左色条卡片上会被剥底色，必须用 `<table bgcolor>` 双保险"。2026-08-14 律川 Planet 账号真机双层实测（Playwright 直连编辑器真实粘贴归一化层 + 保存草稿 + 服务端回读层）逐项验证了同事戴桁宇《公众号排版组件库》的争议元素，结论推翻了这条：

| 实测点 | 粘贴层 | 服务端回读层 |
|---|---|---|
| `<section>` + `linear-gradient` 背景 | ✅ | ✅ |
| `<section>` + `border-image:linear-gradient` 渐变竖条 | ✅ | ✅ |
| `<section>` + `box-shadow` 双层阴影 | ✅ | ✅ |
| `rgba()` 半透明色 | ✅ | ✅ |
| `<table>` + `border-collapse:collapse` 三列横排 | ✅ | ✅ |
| 行内 `linear-gradient` 下划线高亮 | ✅ | ✅ |

**变更：**
- SKILL.md：「HTML 容器」第 1 类里作废"section 会剥底色"一条，改为"`<section>` 是安全的带底色/带左竖条容器（含渐变/阴影/border-image 双层实测通过）"；`bgcolor` 双保险由"必须"降为"可选保底"
- html-paste-whitelist.md：`<section>` 标签白名单 ⚠️→✅；CSS 白名单补 `border-image`、`box-shadow`（`<section>` 上保留、`inset` 剥、`<img>` 上慎用）、`linear-gradient 作 <section> background` 三条；"有底色的卡片用 bgcolor 双保险"章节整节作废重写；"卡片容器"示例同步改为直接 section 带底色
- pre-paste-checklist.md：A 容器层那条"section 剥底色"检查作废改写；一键 lint 伪代码移除"缺 bgcolor 报 WARN"逻辑（留注释说明已作废）

**唯一保留的谨慎点：** 三列 `<table>` 的 `td width:33.33%` 百分比仍会被 ProseMirror 剥离、迁到 `<colgroup>`、table 被 `.tableWrapper` 加 `min-width:75px`——**窄屏仍有溢出风险**，印证了老警告"嵌套 table 百分比宽度会被重排"。移动端三列卡片要控文字长度/字号。

**新增（本次一并落盘）：**
- `capabilities/wechat-visual-style/` —— 官微排版视觉组件库 skill（由戴桁宇《公众号排版组件库.md》转 skill 格式，12 套组件 + 品牌色板 + 间距节奏，补实测结论头注与三列卡片移动端溢出警示）。与避坑 skill 互补：避坑判"能不能写"，组件库给"写成什么样式"。

## 0.4.0 (2026-06-03)

**新增功能：草稿箱一键上传（draft/add API）。**

此前 skill 把"公众号草稿 API"列为死路一条。2026-06-03 核实官方文档后纠正：草稿接口真实可用，只是有账号门槛——本版补齐完整配置与脚本。

**账号门槛（已核实纠正，别写死"只有认证号能用"）：**
- **创建草稿（draft/add）个人/未认证订阅号实测可行**——135/壹伴等第三方工具同步到草稿箱走的就是这条接口
- **2025-07 回收的是 API 自动"群发/发布"(freepublish)**，不是创建草稿；两步分开。早期 skill 把"草稿 API"整体当死路、说个人号一律走不通，是把"创建草稿"和"发布给粉丝"混为一谈，本版纠正
- 个人/未认证号最后"发布给粉丝"仍需手机端【公众号助手】手动点；少数号直连 draft/add 会遇到 48001（平台口径不一致），可走第三方授权或后台申诉

**最大的坑：**
- 草稿 API 的 `content` 字段**不接受 base64 图片**（外链/base64 一律被过滤），必须先把每张图传到微信图床（uploadimg）换成 mmbiz URL——与手动粘贴工作流（只认 base64）完全相反

**接口链路（四步，全服务器端 HTTPS）：**
1. `stable_token` 取 access_token（带缓存，7200s）
2. 正文每张图 `media/uploadimg` → 换 mmbiz URL（jpg/png，<1MB，不占素材配额）
3. 封面 `material/add_material?type=image` → 拿永久 `thumb_media_id`
4. `draft/add` 提交 → 进后台草稿箱（不自动群发，留人工最后一步）

**新增文件：**
- `references/draft-api-upload.md` —— 配置（认证、AppID/Secret、IP 白名单）、四步接口链路、content 约束、错误码表、来源链接
- `scripts/upload_to_draft.py` —— 输入 HTML 自动完成取 token→换图→传封面→进草稿箱，凭证走环境变量，错误码带中文提示

**配套更新：**
- SKILL.md：「标准流程」改写为两条工作流（A 手动粘贴 / B 草稿 API），按账号类型选；frontmatter description 增加草稿上传场景；引用资料/版本号同步

## 0.3.0 (2026-06-03)

**回填 2026-04 法律元力 / Lawvable / MyAgents 系列 13 篇推文的早期实战踩坑。**

这批坑沉淀在先于本 skill 的项目排版规范里（2026-04-17 ~ 04-23 四次修订），属于 HTML 层"样式能粘进去、但手机端塌 / 错位 / 描框"的细节坑，此前未并入 skill。本次全部补齐。

**HTML 容器层新增 7 条：**
- **CSS `width:100%` 在手机端被挤成细条** —— 编辑器把它算成 720px 画布下的固定像素再塞到手机。满宽一律用 HTML 属性 `width="100%"`，不写 CSS `width:100%`。⚠️ 同时修正了 html-paste-whitelist.md / skeleton.md 里原本用 `style="width:100%"` 的卡片、分割线、图片示例
- **`bgcolor` 双保险** —— `<section style="background-color">` 在长块/左色条卡片上会被剥底色；所有有底色的卡片改用 `<table bgcolor="X" style="background-color:X">` + 每个 `<td bgcolor="X">`，HTML 属性和 inline 各写一遍
- **进度条/评分条让 `<td>` 自己当色块** —— 内层 `<div style="background-color">` 背景被剥成空格子；改让 `<td bgcolor width="X%">` 成色，且必须填 `&nbsp;` + `font-size:0`，否则空 `<td>` 在手机端会塌
- **同色自由段落不套 `<table>`** —— 底色等于页面底色的开篇/结尾段落，套同色 table 也会被编辑器描出一圈框；只用 `<section>` + `<p>`。口诀"要不要框 = 要不要 bgcolor"
- **卡片与正文左右对齐** —— 卡片外层 `<section>` 统一 `padding:0 24px`，跟正文同一套水平缩进，否则卡片贴边、正文内缩，并排很乱
- **禁用 `::before` / `::after`** —— 伪元素依赖 `<style>`，必丢；圆形序号徽章用 `display:inline-block` 的 span、装饰引号用 `&ldquo;` + 定位 span 替代
- **可用属性补全** —— `display:inline-block`（徽章/标签）、`letter-spacing`、`vertical-align` 实测保留，补进 CSS 白名单

**正文层新增 1 条：**
- **列表每条独立 `<p>`，不用 `<br/><br/>`** —— 在一个 `<td>` 里用 `<br/><br/>` 分隔 bullet，WeChat 会把 td 开头第一段单独套 `<p>`，导致第一条标号掉行错位；改为每条 bullet 独立 `<p>`（前面 `margin:0 0 12px 0`、末条 `margin:0`）

**配套更新：**
- SKILL.md：「1. HTML 容器」新增 6 条、「2. 正文段落」新增列表 2 条
- html-paste-whitelist.md：新增 width 属性、bgcolor 双保险、进度条 td、列表独立 p 章节；CSS 白名单补 display:inline-block / letter-spacing / vertical-align、补 `::before/::after` ❌ 行；修正示例里的 `style="width:100%"`
- pre-paste-checklist.md：新增 CSS width / bgcolor 卡片 / 空 td 塌缩 / `<br/><br/>` 列表 / 卡片对齐 / 伪元素 6 条检查，一键 lint 伪代码同步扩展

## 0.2.1 (2026-05-28)

**纠正 0.2.0 正文 CSS 方案：`word-break: keep-all` 是错的。**

在 mp.weixin.qq.com 编辑器 Playwright 实测中，对比了 7 组 CSS 组合（justify × keep-all/break-word/normal/inter-character），结论：

- ❌ `word-break: keep-all` 限制中文只在标点/空格处换行 → 每行字数不均 → justify 拉伸短行导致字间距稀疏
- ✅ `word-break: normal`（CSS 默认）中文按字符自然换行 → 每行字数均匀 → justify 拉伸自然
- ✅ 英文长词在 `normal` 下同样整词换行，不会被截断

**变更：**
- SKILL.md 正文段落：`keep-all` → 删掉，改为 `word-break: normal` 或默认
- html-paste-whitelist.md：重写"正文对齐"章节，新增 keep-all 失效原因说明
- pre-paste-checklist.md：lint 规则从"缺 keep-all 就 WARN"反转为"有 keep-all 就 WARN"

## 0.2.0 (2026-05-27)

实战发稿过程沉淀的 4 个新坑，全部来自律川 Planet「钻石型团队」文章的真实粘贴失败。

**HTML 容器层：**
- `<figure>` 同 `<div>` 命运，会被降级丢样式——图片包装也必须用 `<table><tr><td>`
- **HTML 属性 `<table border="0">` 完全不生效**——编辑器照样给每个 table 自加 1px 灰边，必须 inline `style="border:0;border-collapse:separate;"` 才能压住。每个 `<td>` 也要前置 `border:0;`
- **嵌套 `<table width="X%">` 的百分比宽度被强制拉成 100%**——所有"几何对比图"（金字塔、对比柱、流程图）用嵌套 table 都会变等宽，必须改用 SVG 兜底
- **`<body style="background:#XXX">` 不会均匀生效**——部分元素吸到底色、部分没吸到，渲染"花"。body 保持默认白底，需要色块就在具体 td 上画

**图片层：**
- `<img>` 上加 `box-shadow` 可能让整个 img 标签被丢
- base64 安全线收紧：原 200KB 改 ≤135KB（>150KB 常被静默吃掉）

**正文层：**
- 单独的 `text-align:justify` 不够——必须配 `word-break:keep-all; overflow-wrap:break-word;`，否则中英混排时英文长词（Anthropic、ProseMirror、indemnity）会在词内部被截断换行

**新增使用场景：**
- "SVG 是几何图表的逃生通道"——对需要精确比例的图表，跳过 HTML 嵌套 table，直接 SVG

**配套更新：**
- `references/pre-paste-checklist.md` —— 加入 figure / border / 嵌套 width / body bg / box-shadow / base64 大小 6 条新检查
- `references/html-paste-whitelist.md` —— 新增"HTML 属性陷阱"专章，含 nested-table → SVG 决策规律
- 一键 lint 伪代码同步扩展

## 0.1.0 (2026-05-26)

- 初始版本
- 4 类避坑速查：HTML 容器 / 正文 / SVG 插图 / 图片
- 基于 2026-05-26 公众号 ProseMirror 编辑器完整实测
- references/ 4 份：html-paste-whitelist / svg-pitfalls / pre-paste-checklist / reuse-and-copy
- SVG 避坑规则核心吸收自杨卫薪律师 svg-article-illustrator（MIT License）