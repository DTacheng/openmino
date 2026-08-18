# 粘贴进公众号编辑器前的自检清单

在把 HTML 推送给用户、让他粘贴进 mp.weixin.qq.com 之前，逐条扫一遍。每条都给了快速 grep / regex，可以用代码或人工任选。

---

## A. 容器层

- [ ] **没有 `<div>` 标签** —— grep `<div`，应该 0 命中
  - 例外：HTML 文档外壳的 `<html>/<body>` 可以有，但正文区不要
  - 替换方案：所有视觉容器改用 `<table><tr><td style="...">`
- [ ] **没有 `<figure>` 标签** —— grep `<figure`，应该 0 命中
  - figure 与 div 同命运，会被降级丢样式
  - 图片包装也用 `<table><tr><td>`
- [ ] **没有 `<style>` 块** —— grep `<style`，应该 0 命中
  - 所有 CSS 必须内联到 `style="..."` 属性
- [ ] **没有 class 选择器** —— grep `class="`，应该全部是 0 命中或全部能被替换为内联 style
- [ ] **每个 `<table>` 的 style 都包含 `border:0;`** —— HTML 属性 `border="0"` 不被编辑器认，必须 inline
  - 检查方法：grep `<table[^>]*style="(?!.*border:0)` 应该 0 命中
  - 推荐组合：`style="border:0;border-collapse:separate;background:transparent;..."`
- [ ] **每个 `<td>` 的 style 都包含 `border:0;`**（带视觉边界的 td 后面再写 `border-left:Npx solid X;` 同属性后写胜出）
  - 检查方法：grep `<td[^>]*style="(?!.*border:0)` 应该 0 命中
- [ ] **嵌套 `<table>` 不要用百分比宽度做几何对比** —— `<table width="X%">` 在嵌套场景被强制拉成 100%
  - 检查方法：grep `<td[^>]*>\s*<table[^>]*width="[0-9]+%"` 看是否有几何对比意图
  - 替换方案：改用 SVG（viewBox 坐标不会被编辑器重排）
- [ ] **`<body>` 没设 `background:#XXX`** —— body 底色不均匀生效，渲染会"花"
  - 检查方法：grep `<body[^>]*style="[^"]*background`
  - 替换方案：body 保持默认白底，需要色块就在具体 td 上画
- [ ] **没有 CSS `width:100%`** —— 手机端会被算成固定像素塌成细条，满宽改用 HTML 属性 `width="100%"`
  - 检查方法：grep `style="[^"]*width:\s*100%` 应该 0 命中（`max-width` 不算）
- [ ] **有底色的卡片直接用 `<section>` 带底色**（2026-08-14 双层实测已作废"section 会剥底色"）——`<section>` 上的 `background-color`/`linear-gradient`/`border-left`/`border-image`/`box-shadow` 均保留，无需 `<table bgcolor>` 双保险
  - `bgcolor` 双保险写法仍可用作保底，但不再必要
  - 反向：底色等于页面底色的自由段落**不要**套 table（口诀：同色不套 table，要底色直接上 section）
- [ ] **进度条/色块没有内层 `<div background>`，空 `<td>` 都填了 `&nbsp;`+`font-size:0`** —— 否则色块被剥、空 td 手机端塌
- [ ] **卡片外层 `<section>` 都是 `padding:0 8px`** —— 与正文对齐，否则卡片贴边、正文内缩；24px 叠加编辑器自带边距太窄（2026-08-14 起由 24px 改为 8px）
  - 例外：full-bleed 品牌色条、通铺 hero/footer
- [ ] **没有 `::before` / `::after`** —— grep `::before|::after` 应该 0 命中（依赖 `<style>`，必丢）

## B. 正文

- [ ] **所有正文 `<p>` 都带 `text-align:justify`** —— 左右对齐
  - `word-break` 保持默认 `normal` 即可（中文自然按字符换行、英文按词换行）
  - 可选 `overflow-wrap:break-word` 兜底防极端超长不可断词
  - **禁止使用 `word-break:keep-all`** —— 会在 justify 时导致中文字间距稀疏不匀
  - 检查方法：grep `<p style="margin:` 但**不含** `text-align:justify` 的段落
  - 例外：标题、`<blockquote>`、卡片内 `<p>`、居中小标签
- [ ] **列表没有在单 `<td>` 里用 `<br/><br/>` 分隔 bullet** —— WeChat 会把首段单独套 `<p>`，导致第一条标号掉行错位
  - 检查方法：grep 列表型 `<td>` 内是否出现 `<br/><br/>` / `<br><br>`
  - 替换方案：每条 bullet 用独立 `<p>`（前面 `margin:0 0 12px 0`、末条 `margin:0`）
- [ ] **没有 `position: absolute/fixed`** —— grep `position:\s*(absolute|fixed)`
- [ ] **没有 `display: flex/grid`** —— grep `display:\s*(flex|grid)`
- [ ] **没有 CSS 变量** —— grep `var\(--`，全部要展开成实际值

## C. SVG 插图

如果文章含 `<svg>`：

- [ ] **背景非纯白** —— 第一个 `<rect>` 的 fill 不是 `#fff` / `#FFFFFF` / `white`
- [ ] **所有 `<rect>` 都有 `rx`** —— grep `<rect` 且不含 `rx=`，应该 0 命中
- [ ] **没有 `<filter>` / `filter=` 属性** —— grep `filter`，应该 0 命中（除了文件名/注释里的）
- [ ] **没有 `<linearGradient>` / `<radialGradient>`** —— grep `Gradient>`，应该 0 命中
- [ ] **没有 `fill="url(#...)"`** —— grep `fill="url\(`，应该 0 命中
- [ ] **translate 陷阱检查** —— 凡是 `transform="translate(...)"` 的元素，其内部的 `<animateTransform>` 必须是 `type="scale"` 或 `type="rotate"`，**不能是 `type="translate"`**
- [ ] **画布尺寸是 800×450** —— `viewBox="0 0 800 450"`（信息图可以是 800×N，但宽度固定 800）
- [ ] **外层 svg 有完整属性** —— `xmlns`、`width`、`height`、`viewBox`、`role="img"` 都要有
- [ ] **有箭头/虚线框的，必须配动画** —— 静态箭头看起来"死了"
- [ ] **emoji 字号 ≥80px、正文字号 ≥24px** —— 手机端字小看不清

## D. 图片

- [ ] **所有 `<img src>` 都是 `data:image/...;base64,...`** —— grep `src="(?!data:)`，应该 0 命中
- [ ] **`<img>` 上没有 `box-shadow`** —— 复合 css 可能让整个 img 被丢
  - 检查方法：grep `<img[^>]*box-shadow`
  - img 的 style 保持干净：display / width / height / border / margin 就够了
- [ ] **每张图 base64 ≤135KB（实测安全线）** —— 对应原图 ~100KB JPEG
  - >150KB base64 在粘贴时常被静默吃掉
  - 大图先用 PIL/Sharp 缩到 800px 宽再编码
- [ ] **整篇 HTML 体积 ≤5MB** —— 否则编辑器粘贴会卡甚至崩
- [ ] **每张 `<img>` 都有 alt** —— accessibility 友好

## E. 复用素材

- [ ] **如果素材是从别处复用的，确认是从原始 .md/.svg 源文件来的**
- [ ] **不是从已发布的公众号文章复制 SVG**（剪贴板对 inline SVG 不可靠，详见 `reuse-and-copy.md`）

---

## 一键 lint 伪代码（如果要写脚本）

```python
def lint_wechat_html(html: str) -> list[str]:
    errors = []

    # A. 容器层
    if re.search(r'<div\b', html):
        errors.append('FATAL: 含 <div> 标签，会被降级为 <p> 丢失样式')
    if re.search(r'<figure\b', html):
        errors.append('FATAL: 含 <figure> 标签，同 <div> 命运')
    if re.search(r'<style\b', html):
        errors.append('FATAL: 含 <style> 块，公众号会整段丢弃')
    if re.search(r'var\(--', html):
        errors.append('FATAL: 含 CSS 变量 var(--...)，编辑器解析不了')
    if re.search(r'<body[^>]*style="[^"]*background', html):
        errors.append('FATAL: <body> 设了 background，会在编辑器里不均匀生效')
    if re.search(r'::before|::after', html):
        errors.append('FATAL: 含 ::before/::after 伪元素，依赖 <style> 必丢——改用 inline-block span')
    # CSS width:100% squishes on mobile — use HTML attribute width="100%"
    for m in re.finditer(r'style="([^"]*\bwidth:\s*100%[^"]*)"', html):
        if 'max-width' not in m.group(1):
            errors.append(f'WARN: CSS width:100% 手机端会塌成细条，改用 HTML 属性 width="100%" — {m.group(0)[:60]}')
    # (2026-08-14 实测已作废:section 带底色安全,bgcolor 双保险不再必要,移除原 WARN)
    # tables / tds without border:0 in inline style
    for m in re.finditer(r'<table\b[^>]*style="([^"]*)"', html):
        if 'border:0' not in m.group(1) and 'border:none' not in m.group(1):
            errors.append(f'FATAL: <table> 缺少 inline border:0，编辑器会自加灰边 — {m.group(0)[:80]}')
    for m in re.finditer(r'<td\b[^>]*style="([^"]*)"', html):
        if 'border:0' not in m.group(1) and 'border:none' not in m.group(1):
            errors.append(f'FATAL: <td> 缺少 inline border:0 — {m.group(0)[:80]}')
    # nested table with percentage width (geometric diagram red flag)
    for m in re.finditer(r'<td\b[^>]*>\s*<table[^>]*width="[0-9]+%"', html):
        errors.append(f'WARN: 嵌套 <table width="X%"> 会被编辑器强制等宽，几何对比图请改 SVG — {m.group(0)[:80]}')

    # B. 正文
    for m in re.finditer(r'<p\s+style="([^"]+)"', html):
        style = m.group(1)
        if 'margin:' in style:  # likely body paragraph
            if 'text-align' not in style:
                errors.append(f'WARN: <p> 缺少 text-align:justify — {m.group(0)[:60]}')
            if 'word-break:keep-all' in style.replace(' ', ''):
                errors.append(f'WARN: <p> 用了 word-break:keep-all，会在 justify 时导致字间距稀疏 — {m.group(0)[:60]}')

    # C. SVG
    if '<svg' in html:
        if re.search(r'fill="#[fF]{3,6}"', html):
            errors.append('FATAL: SVG 用了纯白背景')
        if re.search(r'<linearGradient|<radialGradient|fill="url\(', html):
            errors.append('FATAL: SVG 用了渐变')
        if re.search(r'<filter|filter=', html):
            errors.append('FATAL: SVG 用了 filter')
        for m in re.finditer(r'<rect(?![^>]*\brx=)', html):
            errors.append(f'WARN: <rect> 没有 rx 圆角 — {m.group(0)[:60]}')

    # D. 图片
    for m in re.finditer(r'<img[^>]+src="([^"]+)"', html):
        if not m.group(1).startswith('data:'):
            errors.append(f'FATAL: <img> src 不是 base64 — {m.group(1)[:50]}')
    if re.search(r'<img[^>]*box-shadow', html):
        errors.append('FATAL: <img> 上有 box-shadow，可能让 img 被吃掉')
    # base64 image >135KB
    for m in re.finditer(r'<img[^>]+src="data:image/[^;]+;base64,([^"]+)"', html):
        if len(m.group(1)) > 135 * 1024:
            errors.append(f'WARN: <img> base64 >{135}KB，可能粘不进编辑器（实测安全线）')

    return errors
```

如果要做正式的 lint 工具，写到 `scripts/lint-wechat-html.js`，配上 CLI 入口。

---

## 没出现在清单里的"不必担心"事项

这些以前以为是坑、实测后证明不是：

- ❌ ~~`<svg>` 会被 ProseMirror sanitize 掉~~ —— **粘贴和保存全程零过滤**（2026-05-26 实测）
- ❌ ~~SMIL 动画 `<animate>` `<animateTransform>` 会被服务端丢~~ —— **保留**
- ❌ ~~编辑器 contenteditable 区域不渲染 SMIL 动画~~ —— **会渲染**，`svgCurrentTime` 在跑
- ❌ ~~需要走"代码模式"或"源码视图"才能粘 SVG~~ —— **没有源码模式，直接粘就行**
- ❌ ~~需要走第三方编辑器（秀米/壹伴）才能弄 SVG~~ —— **不需要**
