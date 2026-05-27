# 粘贴进公众号编辑器前的自检清单

在把 HTML 推送给用户、让他粘贴进 mp.weixin.qq.com 之前，逐条扫一遍。每条都给了快速 grep / regex，可以用代码或人工任选。

---

## A. 容器层

- [ ] **没有 `<div>` 标签** —— grep `<div`，应该 0 命中
  - 例外：HTML 文档外壳的 `<html>/<body>` 可以有，但正文区不要
  - 替换方案：所有视觉容器改用 `<table><tr><td style="...">`
- [ ] **没有 `<style>` 块** —— grep `<style`，应该 0 命中
  - 所有 CSS 必须内联到 `style="..."` 属性
- [ ] **没有 class 选择器** —— grep `class="`，应该全部是 0 命中或全部能被替换为内联 style

## B. 正文

- [ ] **所有正文 `<p>` 都带 `text-align:justify`**
  - 检查方法：grep `<p style="margin:` 但**不含** `text-align:` 的段落
  - 例外：标题、`<blockquote>`、卡片内 `<p>`、居中小标签
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
- [ ] **每张图 base64 编码前 ≤200KB** —— 编码后会膨胀到 ~270KB
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
    if re.search(r'<style\b', html):
        errors.append('FATAL: 含 <style> 块，公众号会整段丢弃')
    if re.search(r'var\(--', html):
        errors.append('FATAL: 含 CSS 变量 var(--...)，编辑器解析不了')

    # B. 正文
    for m in re.finditer(r'<p\s+style="([^"]+)"', html):
        if 'text-align' not in m.group(1) and 'margin:' in m.group(1):
            errors.append(f'WARN: <p> 缺少 text-align:justify — {m.group(0)[:60]}')

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
