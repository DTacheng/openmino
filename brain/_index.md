---
title: 第二大脑 · 知识库索引
updated: 2026-05-26
---

# 第二大脑 · 知识库索引

阿成的跨工作空间共享知识库。所有工作空间的 Agent 都可以通过绝对路径读写这里的知识。

**知识库路径**：`C:\Users\PC\.myagents\projects\mino\brain\`

---

## 架构：客观与主观分离

知识库严格区分两类信息：

```
brain/
├── sources/        ← 客观资料库（外部事实，可验证）
│   └── *.md           每条资料：来源、链接、摘录、存档路径
│
├── concepts/       ← 主观·概念卡片（我们的理解和提炼）
├── insights/       ← 主观·洞见记录（我们的判断和观察）
├── decisions/      ← 主观·决策记录（我们的选择和理由）
└── resources/      ← 内部资源索引（指向工作空间文件）
```

**原则**：
- `sources/` 存放的是**外部客观事实**——有出处、有链接、可验证
- `concepts/` `insights/` `decisions/` 存放的是**我们基于这些事实做出的总结、提炼、判断**
- 主观条目通过 `refs:` 字段引用 sources/ 中的客观资料，保持可溯源
- 重要资料应下载原文到 `sources/archive/` 存档

---

## 条目格式规范

### 客观资料（sources/）

```yaml
---
title: 资料标题
type: report | article | data | official | api-doc
url: 原始链接（必填）
publisher: 发布方
date: 发布日期（如有）
accessed: 最后访问日期
archive: sources/archive/文件名（如有本地存档）
tags: [标签]
---

## 关键摘录

从原文中提取的核心数据和事实（不加主观评论）
```

### 主观知识（concepts/ insights/ decisions/）

```yaml
---
title: 条目标题
tags: [标签1, 标签2]
links: [相关条目.md]
refs: [sources/引用的资料.md]    # ← 指向客观资料
updated: YYYY-MM-DD
---

正文（我们的分析、提炼、判断）
末尾用 [[文件名]] 标记相关条目
```

---

## sources/ — 客观资料库

外部资料索引，每条可验证、可追溯。

| 条目 | 类型 | 来源 | 说明 | 验证状态 |
|------|------|------|------|---------|
| [yuandian-open-platform.md](sources/yuandian-open-platform.md) | api-doc | 元典开放平台 | 36个接口完整清单、积分定价矩阵、MCP Server状态、福利活动 | ✓ 已验证 |
| [idc-legal-tech-2025.md](sources/idc-legal-tech-2025.md) | report | IDC | 法律科技市场、AI 部署率 | ⚠️ 部分无法验证 |
| [gartner-agentic-ai-forecast.md](sources/gartner-agentic-ai-forecast.md) | report | Gartner | 40%+ agentic AI 项目取消预测 | ✓ 已验证 |
| [thomson-reuters-lawyer-productivity.md](sources/thomson-reuters-lawyer-productivity.md) | report | Thomson Reuters | 12小时/周工时释放（2029年目标） | ✓ 已验证 |
| [miit-openclaw-security-warning.md](sources/miit-openclaw-security-warning.md) | official | CNNVD/工信部 | OpenClaw 82个漏洞、关键CVE | ✓ 已验证 |
| [openclaw-36kr-stars.md](sources/openclaw-36kr-stars.md) | article | 36氪 | OpenClaw 24万+星标、登顶GitHub榜首 | ✓ 已验证 |
| [harvey-ai-funding-growth.md](sources/harvey-ai-funding-growth.md) | article | TechCrunch/CNBC | Harvey $11B估值、AmLaw100多数客户 | ✓ 已验证 |
| [tencent-workbuddy-release.md](sources/tencent-workbuddy-release.md) | article | TechNode | WorkBuddy 2026.3.9发布 | ✓ 已验证 |
| [meta-summer-yue-email-incident.md](sources/meta-summer-yue-email-incident.md) | article | Business Insider | Summer Yue 删邮件事件（SEV1级） | ✓ 已验证 |
| [a16z-ai-market-expansion.md](sources/a16z-ai-market-expansion.md) | article | Fortune/a16z | $13T软件市场、$400B增量 | ⚠️ 上下文混淆 |
| ~~china-lawyer-revenue-data.md~~ | — | — | ❌ **已删除**（陕西30万/北京84万无法确认来源） | — |
| ~~china-ai-agent-market-domestic.md~~ | — | — | ❌ **已删除**（数据无法验证） | — |
| ~~lexisnexis-china-lawyer-ai-survey.md~~ | — | — | ❌ **已删除**（93%数据不重要） | — |

> **验证状态说明**：✓ 已验证（数据可靠）| ⚠️ 数据偏差/待验证/无法验证（需进一步确认或阿成补充来源）

---

## concepts/ — 概念卡片（主观）

| 条目 | 标签 | 说明 |
|------|------|------|
| [法律元力产品.md](concepts/法律元力产品.md) | 产品, skill | 产品定位、Skill 清单、数据资产、贡献者 |
| [智能体架构.md](concepts/智能体架构.md) | 技术, 架构 | AI 三阶段演进、智能体定义与循环 |
| [openclaw.md](concepts/openclaw.md) | 生态, 开源 | OpenClaw 全貌、数据、安全风险、对比 |
| [元典开放平台.md](concepts/元典开放平台.md) | API, 产品, 基础设施, MCP, 增长 | 智能体时代的法律数据基础设施、35接口/MCP已上线/定价、API福利活动、Kimi合作谈判、增长策略与竞品对标 |
| [法律skill分类体系.md](concepts/法律skill分类体系.md) | skill, 分类 | 完整分类、用户身份、工作流模板 |
| [竞品库.md](concepts/竞品库.md) | 竞品, 市场, 行业地图 | 国内法律科技竞品清单(北大法宝/威科/Alpha/聚法/得理/法天使/案牍/幂律/慧多宝),含名称澄清和元典对标地图。**仅供内部参考** |

## insights/ — 洞见记录（主观）

| 条目 | 标签 | 说明 |
|------|------|------|
| [法律行业AI采用现状.md](insights/法律行业AI采用现状.md) | 行业, 趋势 | 律师/法务/体制内/高校四象限分析 |
| [安全与合规风险.md](insights/安全与合规风险.md) | 安全, 合规 | 工信部预警、OpenClaw漏洞、六要六不要 |
| [API安全调用规范.md](insights/API安全调用规范.md) | API, 安全, 合规 | HTTP/HTTPS、Header传Key、反代暴露，区分旧版/新版调用方式 |
| [培训受众画像.md](insights/培训受众画像.md) | 培训, 受众 | 不同听众群体的关注点和接受度 |
| [MCP场景化改造.md](insights/MCP场景化改造.md) | MCP, 产品设计, 场景化 | MCP页面改造复盘：两层设计、5个场景、三层命名、企查查对标 |

## resources/ — 内部资源索引

### 磁盘总 wiki（2026-04-23 搭建）

| 条目 | 标签 | 说明 |
|------|------|------|
| [disk-index.md](resources/disk-index.md) | wiki, index | **主入口** — 三盘按项目/主题的总导航 |
| [appdata.md](resources/appdata.md) | appdata | C 盘应用数据汇总（xwechat_files 16G 等） |
| [downloads.md](resources/downloads.md) | cleanup, downloads | Downloads 目录清理候选清单 |

**项目 wiki**：
- [projects/元力工厂.md](resources/projects/元力工厂.md) — 法律产品核心
- [projects/培训.md](resources/projects/培训.md) — 培训与演讲
- [projects/ami-ecosystem.md](resources/projects/ami-ecosystem.md) — Ami 散落 4 处
- [projects/openwork.md](resources/projects/openwork.md)
- [projects/本地化尽调.md](resources/projects/本地化尽调.md)
- [projects/skills-dev.md](resources/projects/skills-dev.md) — github 开发区

**归档 wiki**：
- [archives/协议文件.md](resources/archives/协议文件.md)
- [archives/企业介绍.md](resources/archives/企业介绍.md)
- [archives/素材内容.md](resources/archives/素材内容.md) — 18.9G 大户
- [archives/历史客户项目.md](resources/archives/历史客户项目.md)

### 原有资源

> 已融合：api-docs（已过期，新版 API 走 open.chineselaw.com）、培训素材库（内容已并入 projects/培训.md）、演讲模板（已迁至 insights/）。

## decisions/ — 决策记录（主观）

| 条目 | 标签 | 说明 |
|------|------|------|
| [知行架构原则.md](decisions/知行架构原则.md) | 架构, 原则 | **顶层设计** — 知行分离 + 客观主观分离 |
| [产品定位决策.md](decisions/产品定位决策.md) | 产品, 战略 | 为什么定位"法律人的 Skill 百宝箱" |
| [竞品提及口径.md](decisions/竞品提及口径.md) | 对外, 演讲, 培训, 原则 | **对外材料绝不主动宣传竞品**,客户问到才被动回应。配套触发清单 + 客户拜访前自检 |
