# 公众号 ProseMirror 编辑器粘贴白名单

**来源：** 2026-05-08 阿成用 Playwright 在 mp.weixin.qq.com 编辑器里反复粘贴测试，加 2026-05-26 SVG 链路实测。
**编辑器版本：** ProseMirror（公众号 2024 改版后的新编辑器，URL `cgi-bin/appmsg?...action=edit&type=77`）。

---

## 标签白名单（实测能保留）

| 标签 | 是否保留 | 备注 |
|---|---|---|
| `<p>` | ✅ | 主力容器之一，可带 style |
| `<h1>` `<h2>` `<h3>` | ✅ | 标题级别和样式都保留 |
| `<blockquote>` | ✅ | 完整保留，适合做引用块/导语 |
| `<table>` `<tr>` `<td>` `<tbody>` | ✅✅ | **唯一可保留 block-level 容器的方案** |
| `<strong>` `<em>` `<span>` | ✅ | 行内强调，可带 style |
| `<a href>` | ✅ | 但只接受微信白名单域名的链接 |
| `<img>` | ✅ | **src 必须 base64**，本地路径和外链都不行 |
| `<svg>` 及所有子标签 | ✅ | 含 `<animate>` `<animateTransform>`，实测 2026-05-26 |
| `<br>` | ✅ | |
| `<ul>` `<ol>` `<li>` | ✅ | 列表正常 |
| `<hr>` | ✅ | |
| `<section>` | ✅ | 安全保留为视觉块容器；带 `background-color`/`linear-gradient`/`border-image`/`box-shadow` 均不剥（2026-08-14 双层实测） |
| **`<div>`** | ❌❌ | **会被整体降级为 `<p>`，所有内联样式连带丢失** |
| **`<figure>`** | ❌❌ | **同 `<div>` 命运**——图片包装用 `<table><tr><td>` |
| `<style>` | ❌ | 整段丢弃，所有 class/CSS 变量都失效 |
| `<script>` | ❌ | 拒收，没有意外 |
| `<iframe>` | ❌ | 拒收 |
| `<video>` `<audio>` | ❌ | 必须走编辑器自带的"视频/音频"插入按钮 |
| `<form>` `<input>` | ❌ | 拒收 |

---

## CSS 白名单（实测能保留，内联写）

所有可用的 CSS 必须**内联在 `style="..."` 里**，class 和 CSS 变量统统无效。

| CSS 属性 | 是否保留 | 备注 |
|---|---|---|
| `color` | ✅ | 文字颜色 |
| `background` / `background-color` | ✅ | 含 `linear-gradient()`（**注意：CSS 渐变可以，但 SVG 渐变不行**） |
| `border` / `border-left` / `border-right` / `border-top` / `border-bottom` | ✅ | 全部保留 |
| `border-image` | ✅ | 渐变竖条 `border-image:linear-gradient(...) 1` 保留（2026-08-14 双层实测新增）；注意 `border-image` 会覆盖 `border-color`，手机端 WebView 渲染需截图确认 |
| `border-radius` | ✅ | 圆角 |
| `padding` / `padding-*` | ✅ | |
| `margin` / `margin-*` | ✅ | |
| `font-size` | ✅ | |
| `font-weight` | ✅ | |
| `font-family` | ✅ | 但手机上字体回退依赖系统 |
| `letter-spacing` | ✅ | |
| `line-height` | ✅ | |
| `letter-spacing` | ✅ | 标题/标签微调字距可用 |
| `vertical-align` | ✅ | `<td>` / inline-block 元素对齐用 |
| `display: inline-block` | ✅ | 徽章、tag 标签可用（圆形序号、关键词标签） |
| `text-align` | ✅ | **正文必须 `justify`**（见正文对齐章节） |
| `width: 100%`（CSS） | ❌ | **被算成 720px 画布固定像素，手机端塌成细条**——满宽改用 HTML 属性 `width="100%"`（见 HTML 属性陷阱） |
| `word-break` | ✅ | **正文用默认 `normal` 即可**——`keep-all` 会导致 justify 中文字间距稀疏（0.2.1 纠正） |
| `overflow-wrap` | ✅ | 可选 `break-word`，兜底超长不可断词 |
| `box-shadow` | ✅ | **在 `<section>` 上保留**（双层阴影 `0 6px 18px ..., 0 0 8px ...` 均保留，2026-08-14 双层实测）；但 **`box-shadow: inset` 剥离**，且 `<img>` 上加 box-shadow 可能让 img 被丢——保持 img 干净 |
| `linear-gradient`（作 `<section>` 的 background） | ✅ | `<section style="background:linear-gradient(...)">` 粘贴+服务端两层全保留（2026-08-14 实测）；行内 `<span>/<strong>` 的 background 渐变同样保留。注：这是 HTML 层的 CSS 渐变，与 SVG 渐变（被禁）不是一回事 |
| `display: none` | ✅ | 但慎用，编辑器视觉会乱 |
| `position: absolute/fixed` | ❌ | 拒收 |
| `flex` / `grid` 系列 | ❌ | 全部失效 |
| `transform` | ⚠️ | 在 `<table>/<td>` 上不可靠 |
| CSS 变量 `var(--xxx)` | ❌ | 整个 var() 解析失败值会丢 |
| class 选择器 | ❌ | `<style>` 块被丢，class 也就没了 |
| `::before` / `::after` 伪元素 | ❌ | 依赖 `<style>` 定义，`<style>` 被丢则伪元素必丢——用 inline-block span 替代 |

---

---

## HTML 属性陷阱（实测）

公众号 ProseMirror 编辑器**只认 inline CSS、不认大部分 HTML 属性**。最容易踩的几个：

### `border="0"` 属性无效

```html
<!-- ❌ 编辑器忽略 border 属性，仍然给 table 自加 1px 灰边 -->
<table cellpadding="0" cellspacing="0" border="0">

<!-- ✅ 必须 inline 进 style -->
<table cellpadding="0" cellspacing="0" border="0"
       style="border:0;border-collapse:separate;background:transparent;">
  <tr>
    <td style="border:0;...">...</td>
  </tr>
</table>
```

每个 `<td>` 的 inline style 也必须前置 `border:0;`。带视觉竖线的 td 后面再写 `border-left:Npx solid X;`——同属性后写胜出，灰边被压制、装饰边保留。

### `width="X%"` 在嵌套 `<table>` 上被强制拉成 100%

```html
<!-- ❌ 想做"金字塔"，3 条不同宽度的色条 —— 编辑器把 inner table 拉成全宽，3 条变等宽 -->
<table width="100%">
  <tr><td align="center">
    <table width="30%"><tr><td style="background:#000;">专家 10%</td></tr></table>
  </td></tr>
  <tr><td align="center">
    <table width="58%"><tr><td style="background:#666;">骨干 20%</td></tr></table>
  </td></tr>
</table>

<!-- ✅ 几何对比图改用 SVG，viewBox 坐标编辑器碰不到 -->
<svg viewBox="0 0 800 240" role="img" width="100%">
  <rect x="150" y="0" width="100" height="48" rx="4" fill="#000"/>
  <text x="200" y="30" text-anchor="middle" font-size="24" fill="#fff">专家 10%</text>
  <rect x="110" y="56" width="180" height="48" rx="4" fill="#666"/>
  <text x="200" y="86" text-anchor="middle" font-size="24" fill="#fff">骨干 20%</text>
</svg>
```

**规律：什么时候用嵌套 table、什么时候用 SVG**
- 视觉容器、卡片、引用块、按钮 → **嵌套 table（百分比宽度被吃掉无所谓）**
- 几何对比、金字塔、对比柱、流程图、关系图 → **SVG**

### `<body style="background:#XXX">` 不均匀生效

```html
<!-- ❌ body 底色在编辑器里"花"——部分元素吸到、部分没吸到 -->
<body style="background:#FAF7F2;">
  <p>段落 A 显示出米色底</p>
  <p>段落 B 还是白底</p>
  <table>...</table>  <!-- 这一段又是米色 -->
</body>

<!-- ✅ body 保持默认白底，需要色块就在具体 td 上画 -->
<body>
  ...
  <table>
    <tr>
      <td style="background:#FAF7F2;padding:24px;">
        需要米色底的内容写在这里
      </td>
    </tr>
  </table>
</body>
```

### `width` 用 HTML 属性，不要用 CSS `width:100%`

电脑上看着没问题，手机上每张卡片被挤成一条细条。根因：编辑器把 CSS `width:100%` 算成它自己 720px 画布下的固定像素（720/680/634px 之类），再把这些固定像素硬塞到手机上，于是嵌套挤压。

```html
<!-- ❌ CSS 百分比宽度，手机端塌缩 -->
<table style="width:100%;background:#f0f9ff;">

<!-- ✅ HTML 属性宽度会被保留，浏览器按相对宽度渲染 -->
<table width="100%" style="background:#f0f9ff;">
```

`max-width:520px` 这种兜上限的可以留在 CSS；`width="100%"` 走 HTML 属性兜下限。`<td>` 的列宽同理用 `width="X%"` 属性，不写 CSS。

### 有底色的卡片：`<section>` 直接带底色即可（2026-08-14 双层实测作废旧结论）

> ⚠️ 本小节的旧结论已作废。旧版声称"`<section background-color>` 长块/左色条会被剥底色、必须用 `<table bgcolor>` 双保险"，经 2026-08-14 律川 Planet 账号真机双层实测（粘贴归一化层 + 服务端保存回读层）**均未复现**：`<section>` 上的纯色、`linear-gradient` 背景、`border-left` 竖条、`border-image` 渐变竖条、`box-shadow` 双层阴影**全部保留**。`<section>` 是安全的带底色/竖条容器。

保留的语倒是：**白色/同色自由段落（开篇/结尾）不要套 table**——所以"有底色卡片"直接写 `<section>`，底色等于页底的自由段落也写裸 `<section>`，两者都不需要 `<table bgcolor>` 包装了。口诀改成：**同色不套 table，要底色直接上 section**。

```html
<!-- ✅ 有底色的卡片：直接 section 带底色（渐变色也可以），不再需要 table bgcolor 双保险 -->
<section style="margin:0 8px 20px; background:linear-gradient(180deg,#fff 0%,#f4f8fc 100%); border:1px solid rgba(8,87,165,0.08); border-radius:14px; padding:18px 16px; box-shadow:0 6px 18px rgba(58,65,80,0.06), 0 0 8px rgba(8,87,165,0.1);">
  卡片内容……
</section>

<!-- ✅ 带左竖条的卡片：section + border-left 直接画（渐变竖条可再叠 border-image） -->
<section style="margin:0 8px 20px; background:linear-gradient(135deg,#fff 0%,#fff 65%,#E8F0F8 100%); border-left:5px solid; border-image:linear-gradient(to bottom,#0857A5,#7ab8e0) 1; border-radius:0 10px 10px 0; padding:14px 16px;">
  卡片正文……
</section>

<!-- ✅ 色块/进度条这类需要"精确几何"的，仍可让 <td> 自己当色块（见下一小节） -->
```

- 外层与正文本应用同一套水平缩进——见下方"卡片与正文对齐"：卡片/正文外层 `<section>` 统一 `padding:0 8px`（2026-08-14 起由 24px 改 8px）
- `<table bgcolor>` 双保险写法**仍可用**（对特定旧编辑器/其他账号是保底手段），只是不再必要；追求"官微视觉风格"的渐变卡片/左渐变条/阴影卡片，直接看 `wechat-visual-style` 组件库
- 手机端 WebView 对 `border-image` 渐变的渲染支持需截图确认（粘贴层/服务端层不剥，但视觉渲染属另一层）

### 进度条/评分条让 `<td>` 自己当色块

内层 `<div style="background-color">` 的背景会被剥掉，看起来就是空格子。改让 `<td>` 自己成色，且空 `<td>` 在手机端会塌——必须填 `&nbsp;` 并 `font-size:0` 压住高度。

```html
<!-- ❌ 内层 div 背景被剥，剩空格子 -->
<td><div style="width:100%;height:10px;background:#0284c7;"></div></td>

<!-- ✅ 色块画在 td 上，&nbsp; + font-size:0 防塌 -->
<td bgcolor="#0284c7" width="19%" style="border:0;background-color:#0284c7;height:14px;line-height:14px;font-size:0;padding:0;border-radius:2px;">&nbsp;</td>
```

- 宽度用 `width="19%"` HTML 属性，不要 CSS `width:19%`（嵌套 `<td>` 里 CSS 百分比不稳）
- 段落间空隙用 `<td bgcolor="#ffffff" width="5">&nbsp;</td>` 插入

---

## 标准排版套路（已验证可复用）

### 卡片容器
外层 `<section padding:0 8px>` 与正文对齐；卡片底色/竖条/渐变直接写 `<section>`（2026-08-14 实测确认无需 table bgcolor 双保险）。
```html
<!-- 纯色底卡片 -->
<section style="margin:24px 8px; background-color:#F5F5F5; border-radius:12px; border-left:6px solid #3B82F6; padding:24px;">
  <p style="margin:0; font-size:16px; color:#333; text-align:justify;">
    卡片正文……
  </p>
</section>

<!-- 渐变+阴影卡片（官微视觉风格，见 wechat-visual-style 组件库） -->
<section style="margin:24px 8px; background:linear-gradient(180deg,#fff 0%,#f4f8fc 100%); border:1px solid rgba(8,87,165,0.08); border-radius:14px; padding:18px 16px; box-shadow:0 6px 18px rgba(58,65,80,0.06), 0 0 8px rgba(8,87,165,0.1);">
  卡片内容……
</section>
```

### 分割线
```html
<table width="100%" style="border:0;">
  <tr><td style="border:0; height:1px; background:#E5E5E5; font-size:0; line-height:1;">&nbsp;</td></tr>
</table>
```

### 列表（每条独立 `<p>`，不用 `<br/><br/>`）
在一个 `<td>` 里用 `<br/><br/>` 分隔 bullet，WeChat 会把 `<td>` 开头的第一段单独套 `<p>`，导致第一条标号掉行错位。改为每条独立 `<p>`。
```html
<section style="padding:0 8px; margin:0 0 22px;">
<table width="100%" bgcolor="#f7fafc" style="border:0; background-color:#f7fafc; border-radius:6px;">
  <tr><td bgcolor="#f7fafc" style="border:0; background-color:#f7fafc; padding:14px 18px;">
    <p style="margin:0 0 12px 0; font-size:15px; color:#3f3f3f; line-height:1.9; text-align:justify;"><span style="color:#0284c7; font-weight:bold;">•</span>&nbsp;&nbsp;<strong>第一条</strong>：……</p>
    <p style="margin:0; font-size:15px; color:#3f3f3f; line-height:1.9; text-align:justify;"><span style="color:#0284c7; font-weight:bold;">•</span>&nbsp;&nbsp;<strong>第二条</strong>：……</p>
  </td></tr>
</table>
</section>
```
（标准 `<ul><li>` 也能用；上面这套是需要控底色/控间距时的稳妥写法。前面条目 `margin:0 0 12px 0`、末条 `margin:0`。）

### 品牌按钮（伪按钮）
```html
<table style="margin:24px auto;">
  <tr>
    <td style="background:linear-gradient(135deg, #3B82F6, #8B5CF6);
               border-radius:30px; padding:14px 36px;">
      <a href="..." style="color:#fff; font-size:16px; text-decoration:none;">
        立即查看
      </a>
    </td>
  </tr>
</table>
```

### 行内高亮下划线
```html
<strong style="background:linear-gradient(180deg, transparent 70%, #FEF3C7 70%);">
  高亮文字
</strong>
```

---

## 正文 `<p>` 必须左右对齐

**所有正文段落只需：**
1. `text-align:justify` —— 左右对齐
2. `overflow-wrap:break-word`（可选）—— 兜底，防止极端超长不可断词撑破容器

```html
<!-- 最简版（推荐）：word-break 默认为 normal，中文自然按字符换行，英文按词换行 -->
<p style="margin:16px 0; font-size:16px; line-height:1.8;
          color:#333; text-align:justify;">
  正文混排 Anthropic、ProseMirror、indemnity……
</p>

<!-- 显式安全版：多一层 overflow-wrap 兜底 -->
<p style="margin:16px 0; font-size:16px; line-height:1.8;
          color:#333; text-align:justify;
          word-break:normal; overflow-wrap:break-word;">
  正文混排 Anthropic、ProseMirror、indemnity……
</p>
```

**为什么不能用 `word-break:keep-all`？**

`keep-all` 限制中文只在标点和空格处换行，导致：
- 每行字数不均匀——有的行 20 个字、有的行 12 个字
- `text-align:justify` 会把短行强行拉伸到行宽，字间距变得稀疏
- 视觉上出现"松散行"夹杂在正常行之间，极不美观

`word-break:normal`（CSS 默认值）：
- 中文在任意字符间自然换行 → 每行字数均匀 → justify 拉伸自然
- 英文在单词边界换行 → "Anthropic" 保持完整，不会在词内截断

2026-05-28 Playwright 编辑器实测确认：`keep-all` 的段落比其他方案多 1 行且高度多 20%（586px 宽下 173px vs 144px），说明行被不均匀拉伸。

**例外（不需要 justify 的场景）：**
- 标题 `<h1>/<h2>`（用 `center` 或 `left`）
- `<blockquote>` 引用（已有 border-left 视觉锚定）
- 卡片内的 `<p>`（卡片有自己的紧凑布局）
- 居中类小标签

**lint 检查方法：** 搜索文档中正文 `<p>` 标签（font-size:16px + color:#333 级别），确保有 `text-align:justify`，同时确认**没有** `word-break:keep-all`。

---

## 图片只接受 base64

```html
<!-- ✅ 唯一可靠 -->
<img src="data:image/png;base64,iVBORw0KGgo..."
     style="display:block; width:100%; margin:16px auto;" alt="..."/>

<!-- ❌ 失效 -->
<img src="./local.png">
<img src="https://example.com/img.png">

<!-- ❌ img 上加 box-shadow 可能让整个 img 被丢 -->
<img src="data:image/png;base64,..." style="box-shadow:0 8px 24px rgba(0,0,0,0.2);"/>

<!-- ✅ img 的 style 保持干净 -->
<img src="data:image/png;base64,..."
     style="display:block; width:100%; height:auto; margin:16px auto; border:0;" alt="..."/>
```

**配套约束：**
- **base64 实测安全线：≤135KB**（对应原图 ~100KB JPEG）—— >150KB base64 在粘贴时常被静默吃掉
- 大图先用 PIL/Sharp 缩到 800px 宽再编码，肉眼差异极小但 base64 减半
- 整篇 HTML 体积控制在 5MB 以内，否则编辑器粘贴会卡甚至崩
- 多图场景可以分段粘贴（每次粘 1-2 张）
- 不要在 `<img>` 上加 `box-shadow`、`filter`、`transform` 等复合 CSS，保持 style 干净（display/width/height/border/margin 就够了）
