# CHANGELOG

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