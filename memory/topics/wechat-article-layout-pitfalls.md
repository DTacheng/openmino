---
name: wechat-article-layout-pitfalls
description: 公众号推文 HTML/SVG 排版避坑 skill 的完整接手上下文 —— 实验过程、核心结论、设计取舍、待办
type: topic
project: 内部工具（cross-project，原起源是律川 Planet 公众号写作场景）
created: 2026-05-26
last_session: 2026-05-26
---

# wechat-article-layout-pitfalls — 接手上下文

## TL;DR

这是一个**写公众号推文时的"粘贴前 lint"工具**。不做生成，只做检查。
位置：`.claude/skills/wechat-article-layout-pitfalls/`

核心覆盖 4 类坑：
1. HTML 容器（`<div>` 死 / `<table>` 活）
2. 正文（`text-align:justify` 强制）
3. SVG 插图（基于 2026-05-26 实测，颠覆性结论见下）
4. 图片（必须 base64）

## 这个 skill 是怎么来的

起源是用户问「想写一个 AI 撰写公众号推文排版避坑 skill」，其中 SVG 部分参考杨卫薪律师的 `svg-article-illustrator`，再加上之前自己踩过的坑（`<div>` 降级、justify 对齐、SVG copy 失败等）。

对话中我犯了一个错误：先入为主认为「公众号 ProseMirror 会 sanitize 掉 SVG」，理由听起来合理（白名单过滤），但用户敏锐地指出逻辑漏洞——「如果是这样，杨律师怎么把动画 SVG 发出来的？」

这个反驳推动我去**实测**。用户提供了公众号后台登录，我用 Playwright 跑了三组实验，**全部推翻了我的猜测**。

## 三个实验（关键结论）

| 实验 | 操作 | 结论 |
|---|---|---|
| **A** | 模拟剪贴板事件，把含 SVG 的 HTML 粘贴进 ProseMirror | DOM 层 `<svg>` `<animate>` `<animateTransform>` 全部保留 |
| **A+** | 检查 `svg.getCurrentTime()` | 时钟在跑（25 秒+），动画在编辑器内**实时运行** |
| **B** | 拦截"保存为草稿"的 POST payload，再刷新拉回服务器版本 | 前端→服务端→重新打开，**SMIL 标签零过滤、零修改** |
| **C** | DOM dump 杨律师文章 `mp.weixin.qq.com/s?__biz=MzUyNTE2MDc1OA==&mid=2247485312&idx=1&sn=95027b1906b2e3239045897a94f6c3c4` | 7 个 SVG 全是裸 inline SVG + SMIL，无任何 `mp-*` 自定义封装、无 gradient、无 filter |

**最终定论：公众号编辑器和服务端对 SVG 完全宽容。杨律师就是 Ctrl+V 直接粘贴。**

那「从已发布文章 copy SVG 失败」的真正原因是：**浏览器剪贴板对 inline SVG 的处理本身不稳定**（选区边界、不同浏览器对 contenteditable 外 SVG 的剪贴板序列化不一致），不是公众号或 ProseMirror 的问题。

## 与杨卫薪律师 svg-article-illustrator 的关系

- **杨律师 skill：** 生成 SVG（MIT License，https://github.com/cat-xierluo/legal-skills）
- **本 skill：** lint 检查（生成不重复造轮子）
- **职责切分：** 用户要生成 SVG → 引导走杨律师 skill；生成后/手写 HTML 后 → 走本 skill 复检
- **致谢：** SKILL.md 和 svg-pitfalls.md 已在文档开头注明吸收来源

## 设计取舍（已敲定的，不要回头改）

1. **位置：放本工作区 `.claude/skills/`，不放法律元力**
   - 理由：是个**横切工具**，写公众号是律川 Planet 的事，但 skill 本身可以服务任何写公众号的场景，不绑业务
2. **职责：只 lint，不生成**
   - 理由：杨律师的 `svg-article-illustrator` 已经做了生成，重复造轮子是负价值
3. **不写自动化粘贴脚本**
   - 理由：公众号订阅号 API 走不通（律川 Planet 不是认证账号），秀米/壹伴对自定义 `<table>` 结构支持差。Ctrl+V 已经是最优路径
4. **不内嵌 lint 脚本代码**
   - 当前只有伪代码（在 `references/pre-paste-checklist.md` 里）
   - 未来如果要做真正的 CLI lint，文件名应该是 `scripts/lint-wechat-html.js`

## 结构

```
.claude/skills/wechat-article-layout-pitfalls/
├── SKILL.md                          # 主入口 + 触发条件 + 4 类避坑速查
└── references/
    ├── svg-pitfalls.md               # SVG 在公众号的所有规则(吸收杨律师 MIT)
    ├── html-paste-whitelist.md       # ProseMirror 实测的标签/CSS 白名单
    ├── pre-paste-checklist.md        # 粘贴前自检清单 + lint 伪代码
    └── reuse-and-copy.md             # 从已发布文章复用素材的陷阱
```

## 待办（如果要继续推进）

| 优先级 | 事项 | 备注 |
|---|---|---|
| ★★★ | 实战使用 1-2 次推文产出，发现新坑及时回填到对应 reference | skill 真正的价值要在用中长出来 |
| ★★ | 写真正的 `scripts/lint-wechat-html.js` CLI 工具 | 当前 `pre-paste-checklist.md` 只有伪代码 |
| ★★ | 写一个最小可粘贴 HTML 模板 `references/skeleton.md` | ✅ 2026-05-27 完成 |
| ★ | 给杨卫薪律师发个礼貌通知 | "已吸收 svg-article-illustrator 的规则到 lint skill，遵守 MIT" |
| ★ | CHANGELOG.md 还没写 | ✅ 2026-05-27 完成 |

## 已确认的反"民间智慧"清单

这些是社区里常见的错误说法，已被本次实测推翻：

- ❌ ~~"ProseMirror 会 sanitize 掉 SVG"~~
- ❌ ~~"SMIL 动画在公众号编辑器里不会运行"~~
- ❌ ~~"必须走代码模式 / 源码视图才能粘 SVG"~~（公众号没有源码模式）
- ❌ ~~"必须走第三方编辑器（秀米/壹伴）才能弄 SVG"~~
- ❌ ~~"杨卫薪律师用了什么浏览器扩展 / API"~~（他就是直接粘贴）

## 关联记忆

- 同一项目记忆系统中应该不存在第二份关于公众号排版的记录——这条 topic 是唯一权威。
- 跨工作区角度：律川 Planet 的业务上下文（账号、粉丝数、已发布文章）留在法律元力工作区（`元力工厂-For.Agents/法律元力/`），不要往本工作区搬。
- 本 skill 与法律元力工作区里的 `growth/新媒体/` 业务素材是**调用方-工具方**关系：业务素材调用本 skill，反过来不调。

## 上次会话标记

- 工作区: `D:/BaiduSyncdisk/产品经理/元力工厂-For.Agents/法律元力/`（原生成位置）
- 已迁移至: `D:/效率创意/mino/.claude/skills/wechat-article-layout-pitfalls/`
- 法律元力工作区里的副本已删除
