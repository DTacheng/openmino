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
| `<section>` | ⚠️ | 部分场景被保留为视觉块容器 |
| **`<div>`** | ❌❌ | **会被整体降级为 `<p>`，所有内联样式连带丢失** |
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
| `border-radius` | ✅ | 圆角 |
| `padding` / `padding-*` | ✅ | |
| `margin` / `margin-*` | ✅ | |
| `font-size` | ✅ | |
| `font-weight` | ✅ | |
| `font-family` | ✅ | 但手机上字体回退依赖系统 |
| `letter-spacing` | ✅ | |
| `line-height` | ✅ | |
| `text-align` | ✅ | **正文必须 `justify`**（见正文对齐章节） |
| `display: none` | ✅ | 但慎用，编辑器视觉会乱 |
| `position: absolute/fixed` | ❌ | 拒收 |
| `flex` / `grid` 系列 | ❌ | 全部失效 |
| `transform` | ⚠️ | 在 `<table>/<td>` 上不可靠 |
| CSS 变量 `var(--xxx)` | ❌ | 整个 var() 解析失败值会丢 |
| class 选择器 | ❌ | `<style>` 块被丢，class 也就没了 |

---

## 标准排版套路（已验证可复用）

### 卡片容器
```html
<table style="width:100%; border-collapse:collapse; margin:24px 0;">
  <tr>
    <td style="background:#F5F5F5; border-radius:12px;
               border-left:6px solid #3B82F6; padding:24px;">
      <p style="margin:0; font-size:16px; color:#333; text-align:justify;">
        卡片正文……
      </p>
    </td>
  </tr>
</table>
```

### 分割线
```html
<table style="width:100%;">
  <tr><td style="height:1px; background:#E5E5E5;"></td></tr>
</table>
```

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

**所有正文段落必须包含 `text-align:justify`**，否则中英文混排+长段落会右侧参差不齐，视觉很丑。

```html
<p style="margin:16px 0; font-size:16px; line-height:1.8;
          color:#333; text-align:justify;">
  正文……
</p>
```

不适用于：
- 标题 `<h1>/<h2>`（用 `center` 或 `left`）
- `<blockquote>` 引用（已有 border-left 视觉锚定）
- 卡片内的 `<p>`（卡片有自己的紧凑布局）
- 居中类小标签

**lint 检查方法：** 搜索文档所有 `<p style="margin:` 开头但**不含** `text-align:` 的段落——多数是漏掉 justify 的正文段。

---

## 图片只接受 base64

```html
<!-- ✅ 唯一可靠 -->
<img src="data:image/png;base64,iVBORw0KGgo..."
     style="display:block; width:100%; margin:16px auto;" alt="..."/>

<!-- ❌ 失效 -->
<img src="./local.png">
<img src="https://example.com/img.png">
```

**配套约束：**
- 单图编码前压到 200KB 以内（base64 后会变 ~270KB）
- 整篇 HTML 体积控制在 5MB 以内，否则编辑器粘贴会卡甚至崩
- 多图场景可以分段粘贴（每次粘 1-2 张）
