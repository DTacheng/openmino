# SVG 在微信公众号的避坑指南

**核心结论（基于 2026-05-26 实测）：** 公众号编辑器和服务端对 SVG **零过滤**——`<svg>`、`<animate>`、`<animateTransform>` 直接粘贴、保存草稿、重新打开、发布全程毫发无损，编辑器内动画也实时运行。

**所以问题不在能不能粘进去，而在 SVG 自身是否符合公众号 H5 WebView 的渲染约束。** 不符合就是"粘进去了，但手机上打开白屏 / 缺元素 / 没动画"。

下面这套规则核心吸收自杨卫薪律师的 `svg-article-illustrator`（MIT License，https://github.com/cat-xierluo/legal-skills），加上律川 Planet 2026-05-26 实测补丁。

---

## 一、强制规则（违反必翻车）

### 1. 背景色 — 禁用纯白
- ❌ `fill="#FFFFFF"` 或不设背景
- ✅ 必须用 `#F5F5F5 ~ #FAF0E6` 浅色范围内的纯色
- **原因：** 公众号正文白底，SVG 也白底的话圆角、边框、轻量分隔线会和正文融为一体看不见

### 2. 容器 — 单层背景
- ❌ 在浅色背景矩形上又叠一层白色/半透明矩形容器
- ✅ 一个 `<rect>` 当画布背景就够

### 3. 圆角 — 矩形必须 `rx="10"`
- ❌ 直角矩形
- ✅ 所有 `<rect>` 加 `rx="10"`（或类似值），保持视觉统一

### 4. Filter — 全禁
- ❌ `<g filter="url(#shadow)">`、`<feDropShadow>`、`<feGaussianBlur>` 等
- ✅ 用纯色 + 透明度模拟阴影
- **原因：** 微信 H5 WebView 不渲染 SVG filter，且 filter 一旦失败会**连带让 SMIL 动画也失效**

### 5. 渐变 — 全禁
- ❌ `<linearGradient>` / `<radialGradient>` / `fill="url(#gradient)"`
- ✅ 所有 fill 用纯色（如 `#10B981`、`#3B82F6`）
- **原因：** 微信 H5 WebView 不渲染 SVG 渐变

### 6. translate 陷阱（最容易出 bug 的地方）
- ❌ 外层 `transform="translate(x,y)"` 定位 + 内层 `<animateTransform type="translate">` 动画
- **后果：** 元素飞到画布左上角，因为动画的 transform 会**完全覆盖**外层定位
- ✅ 想要浮动效果，要么直接用 `cx/cy` (`<circle>`) 或 `x/y` (`<rect>`) 定位，要么 transform 只配 `type="scale"` / `type="rotate"` 动画

| 定位方式 | 安全的动画类型 |
|---|---|
| `transform="translate()"` | `scale`、`rotate` |
| `cx/cy` 或 `x/y` | `translate` |

---

## 二、动画规范（公众号能跑的就这些）

### 支持的动画
- ✅ `<animate>` — 处理颜色、透明度、`stroke-dashoffset`（线条流动）
- ✅ `<animateTransform>` — 处理 `scale`、`rotate`、`translate`（注意 translate 陷阱）

### 不支持
- ❌ CSS `@keyframes` —— 公众号会丢弃 `<style>` 标签里的样式定义
- ❌ JavaScript —— 任何 `<script>` 都会被拒
- ❌ SVG `<use>` 引用外部 SVG 文件

### 动画优先级（杨卫薪律师建议的视觉节奏）
逻辑性动画 > 装饰动画：
1. 箭头绘制（`<animate stroke-dashoffset>`）
2. 虚线框流动（同上）
3. 线条流动
4. 脉冲（`scale`）
5. 浮动（`translate` 但要遵守第 6 条陷阱）

**规则：** 有箭头必须动画、有虚线框必须动画——静态的箭头看起来"死了"。

### 三个常用动效模板

```xml
<!-- 浮动 (8-15px 幅度,2-4 秒周期) -->
<circle cx="200" cy="225" r="60" fill="#10B981">
  <animateTransform attributeName="transform" type="scale"
    values="1;1.1;1" dur="2.5s" repeatCount="indefinite" additive="sum"/>
</circle>

<!-- 虚线框流动 (0.8-1.5 秒速率) -->
<rect x="60" y="60" width="680" height="330" fill="none"
      stroke="#833D8B" stroke-width="2" stroke-dasharray="8,4">
  <animate attributeName="stroke-dashoffset"
    from="48" to="0" dur="2s" repeatCount="indefinite"/>
</rect>

<!-- 箭头绘制 (1-2 秒展示) -->
<line x1="100" y1="200" x2="700" y2="200" stroke="#3B82F6" stroke-width="3"
      stroke-dasharray="600" stroke-dashoffset="600">
  <animate attributeName="stroke-dashoffset"
    from="600" to="0" dur="1.5s" repeatCount="indefinite"/>
</line>
```

---

## 三、布局规范

- **画布尺寸：** 800×450（16:9）—— 杨律师标准；超长信息图可以 800×1240
- **安全边距：** 上下左右各 60px；有效绘制区 680×330
- **标题字号：** 48px，≤6 字
- **正文字号：** 24px
- **Emoji 字号：** 100px（不是 60px——手机上太小）
- **线条粗细：** 4px（细了在手机端看不见）
- **元素间距：** ≥20px
- **元素数量：** 一张图最多 2 个主要元素，避免拥挤
- **配图密度：** 杨律师建议每段落一张，长文 8-15 张

---

## 四、外层 `<svg>` 标签的标准属性

杨律师文章里 SVG 的实际标签（实测）：

```html
<svg xmlns="http://www.w3.org/2000/svg"
     width="800" height="450" viewBox="0 0 800 450"
     style="display: block; vertical-align: middle; max-width: 100%; height: auto; margin: 16px auto;"
     role="img" aria-label="插图">
  ...
</svg>
```

- `width/height` 和 `viewBox` 都要写 —— 移动端有的 WebView 只看一个
- `style` 里那一坨是为了手机端自适应居中
- `role="img" aria-label="插图"` 是无障碍标注，公众号 accessibility tree 会用到

---

## 五、生成 SVG 不要重复造轮子

杨卫薪律师的 **`svg-article-illustrator`**（MIT License，https://github.com/cat-xierluo/legal-skills）已经把所有上述规则封装好了。本 skill 不重复实现 SVG 生成，只做事后 lint。

如果用户需要生成新 SVG，引导他们：
1. 安装并使用 `svg-article-illustrator` skill
2. 生成后用本 skill 的 `pre-paste-checklist.md` 复检一遍
