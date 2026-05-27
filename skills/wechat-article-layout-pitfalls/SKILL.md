---
name: wechat-article-layout-pitfalls
description: 微信公众号推文 HTML/SVG 排版避坑速查。当用户要写公众号推文、生成 HTML 排版、嵌入 SVG 插图、或者从已发布文章复用素材时使用——确保 HTML 粘贴进 mp.weixin.qq.com 编辑器后样式不丢、SVG 动画不丢、正文左右对齐、图片能带得过去。覆盖 ProseMirror 编辑器的粘贴白名单、SVG/SMIL 兼容性、base64 图片要求、二次复用陷阱。
author: 常成（律川 Planet）
version: "0.1.0"
license: CC BY-NC 4.0
---

# 微信公众号推文排版避坑

公众号编辑器（mp.weixin.qq.com 的 ProseMirror）对粘贴的 HTML 不是任意接受的，但坑分布与多数人想象的相反——它**比想象的宽容**（连 SVG + SMIL 动画都收），但**特定标签和 CSS 会被静默丢弃**。这个 skill 是 2026-05-26 一次完整实测后沉淀的避坑清单。

## 何时启用

写公众号推文 HTML 之前 → 启用本 skill 的「粘贴前清单」做 lint。
写完之后 → 按清单核对一遍再交付。
用户报"粘贴进编辑器样式丢了 / SVG 没动画 / 图片显示不出来" → 直接对照 references/ 排查。

## 公众号写作的标准流程

公众号订阅号目前**没有可用的 API 发布路径**，唯一可靠的工作流是：

1. **本地写 HTML** —— 严格按白名单标签和内联 CSS（见 `references/html-paste-whitelist.md`）
2. **打开 mp.weixin.qq.com 编辑器** —— 新建文章
3. **Ctrl+V 直接粘贴整段 HTML** —— ProseMirror 会做白名单过滤
4. **保存草稿后再预览** —— 编辑器内的视觉不等于手机端的视觉
5. **必要时用 Playwright 自动化辅助测试** —— 不是为了自动发布，是为了快速验证一段 HTML 在编辑器里的渲染结果

不要尝试这些路径，会浪费时间：
- 公众号草稿 API（仅服务号/认证订阅号可用，律川 Planet 走不通）
- 秀米 / 壹伴 / 135 编辑器同步（对 `<table>` 自定义结构和复杂 SVG 支持反而更差）
- Markdown 直接导入（公众号当前没有官方 Markdown 入口；ProseMirror 没有源码模式）

## 四类避坑速查

### 1. HTML 容器
- ❌ `<div>` 会被整体降级为 `<p>`，所有内联样式连带丢失
- ✅ 用单 cell `<table><tr><td style="...">` 当容器，背景色、圆角、padding 全保留
- ✅ 竖条装饰用 `border-left: Npx solid #xxx` 直接画在 td 上
- ❌ CSS 变量 (`var(--brand)`) 和 class 选择器全部无效
- ✅ 所有样式必须**内联**写在 `style="..."` 里

### 2. 正文段落
- ✅ 正文 `<p>` 必须包含 `text-align: justify` —— 默认左对齐右侧参差不齐，中英文混排尤其丑
- 不适用于：标题、`<blockquote>`、卡片内 `<p>`、居中类小标签

### 3. SVG 插图（关键 — 多数人这里想错了）
- ✅ **公众号编辑器接受直接粘贴 SVG**，包括 SMIL `<animate>` / `<animateTransform>` 动画
- ✅ 服务端**零过滤** SVG，保存草稿/重新打开/发布后动画完整保留
- ⚠️ 但 SVG **必须遵守公众号 H5 WebView 的渲染限制**：禁用纯白底、禁用 filter、禁用 gradient、translate 陷阱等（见 `references/svg-pitfalls.md`）
- ⚠️ 不要尝试从已发布文章 copy SVG 二次复用——剪贴板对 inline SVG 的处理不可靠（见 `references/reuse-and-copy.md`）
- ⚠️ 不要重复造 SVG 生成轮子——已经有杨卫薪律师的 `svg-article-illustrator` 专门做这件事

### 4. 图片
- ❌ 本地路径 `<img src="./xxx.png">` 粘贴进编辑器后立刻失效
- ❌ 外链 `<img src="https://...">` 微信会拒抓非白名单域名
- ✅ **唯一可靠路径：`<img src="data:image/png;base64,...">`**
- ⚠️ base64 让 HTML 体积膨胀约 33%，单图先压到 200KB 以内再编码
- ⚠️ 整篇文章 HTML 过大（>几 MB）时编辑器粘贴会卡甚至崩，多图考虑分段粘贴

## 粘贴前必跑清单

逐条检查 `references/pre-paste-checklist.md`。

## 引用资料

- `references/html-paste-whitelist.md` —— 公众号 ProseMirror 实测保留的标签和 CSS 白名单
- `references/svg-pitfalls.md` —— SVG 在公众号的渲染约束（吸收杨卫薪律师 `svg-article-illustrator` 的避坑规则，MIT 协议）
- `references/pre-paste-checklist.md` —— 粘贴前 lint 清单
- `references/reuse-and-copy.md` —— 从已发布文章复用素材的陷阱与替代方案

## 关联 Skill

- **`svg-article-illustrator`**（杨卫薪律师，MIT）—— 专门生成符合公众号规范的 SVG 配图，本 skill 不做生成只做 lint
- **`piclist-upload`**（杨卫薪律师，MIT）—— 图片自动上传到图床并替换链接

## 致谢

SVG 避坑规则核心吸收自杨卫薪律师 `svg-article-illustrator`（https://github.com/cat-xierluo/legal-skills，MIT License）。HTML/CSS 兼容性结论来自 2026-05-08 公众号 ProseMirror 编辑器粘贴实测和 2026-05-26 SVG 完整链路实测。
