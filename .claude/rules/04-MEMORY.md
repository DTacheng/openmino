# MEMORY.md - Long-Term Memory

*Your curated memories. The distilled essence, not raw logs.*

## About This File & Memory System

- **Be mindful in shared contexts** — this file contains personal context about your human. In group chats or shared sessions, don't leak private preferences, decisions, or project details

### Three-Layer Memory

Your memory has three layers, each with different responsibilities and access patterns:

**Core memory (this file, 04-MEMORY.md)** — Auto-loaded every session
- What goes here: cross-project lessons, key decisions, user preferences, technical knowledge, one-line project summaries + pointers
- What doesn't: detailed project experience (that's what topic files are for)
- **Add a timestamp `(YYYY-MM-DD)` to each entry** — helps trace back, judge recency, clean up

**Topic memory (`memory/topics/<name>.md`)** — Read before working on a project
- What goes here: full accumulated experience for one project/topic — status, key facts, what you did, what worked, what didn't, decisions and rationale, next steps
- More detailed than core memory (which only has pointers), more synthesized than daily logs (which are raw chronological notes)
- Update during memory maintenance or when a project enters a new phase

**Daily journal (`memory/YYYY-MM-DD.md`)** — Read today + yesterday at session start
- What goes here: what happened that day, raw chronological record
- This is the source of all memory, but searching it for specific project info is inefficient (multiple projects mixed in one day)

### Information Flow

```
Daily logs (raw material) → topic files (synthesized per-project) → 04-MEMORY (cross-project essence)
```

- During work: just write the daily log
- During maintenance: sync from logs to topics, distill new cross-project lessons to this file
- **Information lives in one place only** — don't duplicate between topic files and 04-MEMORY

### When to Read What

- Just woke up → this file is already loaded + read today/yesterday's logs
- About to work on a project → read its `memory/topics/<name>.md`
- Memory maintenance → read all recent logs + all active topic files

---

## Lessons Learned

Organize by topic as your lessons grow. A flat list becomes unreadable fast.

### Working Style

*(How you and your human work best together.)*

### Communication

*(Lessons about tone, format, language, audience.)*

### Product Management

*(以下条目来自小皮在 mino 工区的沉淀，作为共同 know-what 起点)*

- **PRD→Milestone→Issue 分层拆解法（2026-05-07）**：PRD 是需求蓝图，按优先级分到多个 Milestone。Milestone 按可交付状态切（v1.0-alpha → 能看商品 / v1.0-beta → 能加购下单），不是按时间切（"5月工作"）。Issue 的核心判断标准：能不能清晰定义"做完"。能 → 1 个 Issue。不能 → 先拆。PM 写宏观 Issue + 验收条件，研发认领后拆子任务（checklist 或子 Issue）。
- **Burndown vs Burnup（2026-05-07）**：Burndown（燃尽图）= 剩余工作量 vs 时间，实际线在理想线上方 = 进度落后。Burnup（燃起图）= 已完成 + 总工作量两条线，总工作量线上涨 = scope creep（范围蔓延）。

### Technical

*(以下条目来自小皮在 mino 工区的沉淀，作为共同 know-what 起点)*

- **Agent recon 报告必须 reality-check（2026-05-21）**：派 Explore agent 调研复杂 HTTP/RPC 协议时，输出看起来精确（带 line 号、JSON schema、curl 例子），但十有八九有 hallucinated 字段/结构。**用源码 grep verify 关键 schema 后再写代码，不要 copy-paste agent 报告**。
- **"嵌在大产品里的 AI UI"应该走主产品的 session，别另起炉灶（2026-05-21）**：内嵌 LLM 直调 provider key 看似工程简单，实则三个死穴—— 配额（单 key 单池烧得快）/上下文（自己实现 history 没 compaction）/能力断层（MCP+Skills+long-term memory 全失）。**Channel 模式 = thin client + 主产品跑真身**，才是正解。
- **AGPL-3.0 协议的实操边界（2026-05-12）**：copyleft 最严的协议，比 GPL 多堵"SaaS 洞"——通过网络让别人用到也触发开源义务。**可以**：自用/内网用、读源码学思路自己重写、不改原版部署给客户加署名、Fork 后继续 AGPL 开源、商业化（卖服务）。**不能**：抠代码塞闭源产品（整产品被迫开源）、改了部署 SaaS 但不开源改动。借鉴 AGPL 项目最稳姿势=学产品形态和 prompt 设计，代码自己重写。
- **Playwright bundled Chromium 1208 有 `page.pdf()` 绘制 bug（2026-04-19）**：遇到 `display:flex; flex-direction:column` + 内联 `opacity:0; transform:translateY(...)` 的 reveal-card 结构时，PDF 里内容会被静默丢掉（屏幕/截图正常，唯独 PDF 丢）。解法：用系统 Chrome（`channel: 'chrome'`）而非 bundled Chromium。
- **HTML slide 转 PDF 永远不要走"截图合成"路线（2026-04-19）**：字体栅格化、页码错、丢页/重页，同时三病。一次性用 Chromium `page.pdf()` 出矢量 PDF。`html-ppt-to-pdf` skill 就是为此写的。
- **API Key 不能存放在 brain/ 里（2026-04-29）**：明文 Key 是安全风险，且 brain 最终要推 GitHub。Key 只应存在于 MyAgents config 或环境变量中。
- **源文件诚实 ≠ 下游正确（2026-04-29）**：sources/ 里的条目明确标注了数据局限性（⚠️），但 insights/concepts/演讲稿引用时没有带上这些 caveat——数据错误从这里渗入。审计时要从 insight → source → 原始 URL 逐级追溯，不能只看 source 文件本身。
- **Electron 桌面应用默认无法被 Playwright 操控（2026-04-29）**：Electron 应用不开启 CDP 远程调试端口，数据库通常加密，无本地 HTTP API。优先用 API/CLI 而非 UI 自动化获取第三方服务数据。
- **飞书自动化首选 lark-cli（2026-04-29）**：`@larksuite/cli`（命令 `lark-cli`，非 `lark`）是飞书官方 CLI 工具，支持日历/VC/文档搜索/IM 等 40+ 飞书 API。
- **视觉模型擅长"有什么"但不擅长"在哪里"（2026-04-29）**：Qwen3-VL-30B-A3B 能准确描述 UI 截图内容和读取中文文字，但预测的像素坐标偏差 ±30-50px。视觉模型驱动精确 UI 操作不可靠。

## Important Decisions

*(Record key decisions and their reasoning here.)*

## User Preferences

*(What you've learned about how your human likes to work.)*

## Technical Knowledge

*(以下条目来自小皮在 mino 工区的沉淀，作为共同 know-what 起点)*

- **考勤系统（2026-04-27）**：http://172.16.124.31:2345/kqgl/login — 华宇内部考勤管理，密码 6789@jkl
- **元典开放平台 API（2026-04-29 → 2026-05-26 重新清点）**：域名 `open.chineselaw.com`，接口广场入口 `/api-square`，文档入口 `/docs`。当前共 **36 个公开接口**，分 4 类：法律法规(5) / 案例文书(4) / 企业信息(26) / 幻觉检测(1)。**企业类是绝对主力（占 72%）**，覆盖工商→知产→涉诉→执行→经营异常全链路。完整清单见 `brain/sources/yuandian-open-platform.md`。API Key 存 `~/.myagents/config.json` 的 `YD_API_KEY` 全局字段。积分制计费 1~50 分/次。民法典法规 id: `55dceb7d83a1c90e3fe9c141b1118193`。
- **GitHub 开发工作区（2026-04-20）**：`C:\Users\PC\github\` 是阿成所有公开 GitHub repo 的本地开发位置。目前含 `html-ppt-to-pdf`、`md-to-share`、`slide-editor`。

## Ongoing Context

*(Current projects, tasks, and context that matters.)*

*(小飞自己的项目状态写在这里，不要污染小皮 mino 工区的项目状态)*

---

*Update this file as you learn. It's how you persist.*
