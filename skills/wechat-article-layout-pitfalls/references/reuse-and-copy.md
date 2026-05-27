# 从已发布文章复用素材的陷阱

**核心结论：不要从公众号已发布文章直接 copy SVG / 富文本块到编辑器，会丢内容。保留原始 .md / .svg / .html 源文件才是稳的复用路径。**

---

## 问题表象

- 在公众号已发布文章里看到一张漂亮的 SVG 插图
- 想复用：选中 → Ctrl+C → 切到自己的编辑器 → Ctrl+V
- 结果：图片"像"是过来了，但**动画没了**，甚至有时连图都丢了
- 用户多年来一直以为这是"杨卫薪律师的 SVG 不让 copy"，其实根本不是

## 为什么会失败（2026-05-26 实测推断）

通过对杨卫薪律师文章 `mp.weixin.qq.com/s?__biz=MzUyNTE2MDc1OA==&mid=2247485312...` 的 DOM 检查，确认：

1. **文章里的 SVG 本身是干净完整的** —— 7 个 SVG 全部是裸 `<svg>` + SMIL `<animate>`/`<animateTransform>`，没有任何二次封装，每个动画标签都在
2. **公众号编辑器也接受直接粘贴 SVG** —— 实验 A/B 已证实

那为什么 copy 失败？最可能的原因是**浏览器剪贴板对 inline SVG 的处理本身不可靠**：

- 浏览器复制 HTML 时，剪贴板里同时塞了 `text/html` 和 `text/plain` 两份。
- 用户选区如果不正好完整覆盖 `<svg>` 元素的边界，`text/html` 里的 SVG 会被剪裁不全
- 不同浏览器（Chrome/Edge/Firefox）对 contenteditable 区域以外的 SVG 选区行为不一致
- 部分浏览器/扩展会在剪贴板写入前对 SVG 做安全清理（剥 `<animate>` / `<script>` 等）
- 微信文章页是 H5 渲染，SVG 容器外可能包了一层非选区友好的 wrapper

## 推荐的替代路径

### 场景 1：复用自己写的素材
- ✅ **保留原始 .md / .html 源文件**，从源文件 copy
- ✅ 律川 Planet 的素材统一放 `growth/新媒体/<推文目录>/<推文名>_v*.html`
- ✅ 如果用了 `svg-article-illustrator` skill，它会把 SVG 嵌入 .md，**保留这份 .md**

### 场景 2：复用别人公众号文章里的素材
- ⚠️ 法律上需要确认作者授权（杨卫薪律师的 skill 是 MIT，可以放心吸收**规则**和**代码**，但他**生成的具体插图**属于作品，复用要打招呼）
- ✅ 技术上可以用浏览器 DevTools：右键插图 → Inspect → 在 Elements 面板找到 `<svg>` 元素 → 右键 Copy → "Copy outerHTML" → 粘到新文章源 HTML 里
- ⚠️ 这条路也不是 100% 稳，最稳的还是请对方提供原始 .svg / .md 文件

### 场景 3：在编辑器里二次编辑已有草稿
- ✅ **直接打开已保存的草稿继续编辑** —— 草稿里的 SVG 是从服务端拉回的完整版本（实测 2026-05-26）
- ✅ 不要从已发布文章 copy 回草稿——绕了一圈反而丢东西

---

## 如果非要从已发布文章 copy

万一就是只剩这条路（比如源文件丢了），按这个顺序尝试：

1. **DevTools 复制 outerHTML** —— 右键 SVG → Inspect → 找到 `<svg>` 元素 → Copy → Copy outerHTML
2. **粘贴到本地编辑器（VSCode）查看** —— 确认 `<animate>`/`<animateTransform>` 标签是否完整
3. **如果完整，再从本地源文件 copy 粘贴到公众号编辑器** —— 此时是从干净的源粘贴，会成功
4. **如果不完整**（动画标签丢了），别再试了，换图

---

## 给 skill 用户的建议话术

如果用户问"我能不能从公众号文章 copy 这张 SVG 用？"，标准回复：

> 不建议直接 copy，浏览器剪贴板对 inline SVG 的处理不稳定，动画大概率会丢。
>
> 建议三选一：
> 1. 找原作者要 .md 或 .svg 源文件（最稳）
> 2. 用 `svg-article-illustrator` skill 自己重新生成一张同款风格的（杨卫薪律师 MIT 协议）
> 3. 如果你只是想要一张静态截图，浏览器自带的"截图"或 macOS 的 `Cmd+Shift+4` 就够了

---

## 注释：杨卫薪律师 svg-article-illustrator 的授权

- License: **MIT**
- 仓库: https://github.com/cat-xierluo/legal-skills
- 路径: `skills/svg-article-illustrator/`
- 作者: 杨卫薪律师（微信 ywxlaw）

MIT 协议允许我们：
- ✅ 复制、修改、商用、再发布
- ⚠️ 必须保留作者署名和 LICENSE 声明
- ⚠️ 但**作者已发布的具体作品（如某篇文章里的具体插图）不属于 skill 的代码范围，复用要单独打招呼**
