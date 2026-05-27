---
title: OpenClaw 生态全貌
tags: [生态, 开源, agent, 安全]
links: [智能体架构.md, 安全与合规风险.md]
refs:
  - sources/openclaw-36kr-stars.md
  - sources/tencent-workbuddy-release.md
  - sources/miit-openclaw-security-warning.md
  - sources/meta-summer-yue-email-incident.md
updated: 2026-05-26
---

# OpenClaw 生态全貌

## 基本信息

- **创始人**：Peter Steinberger（奥地利工程师，PSPDFKit 创始人，此前运营 PDF SDK 公司 13 年）
- **起源**：2025 年 11 月，最初叫 Clawdbot，是 WhatsApp 消息中继实验
- **命名历程**：Clawdbot → MoltBot（因 Anthropic 商标问题）→ OpenClaw
- **开源协议**：MIT
- **江湖人称**：小龙虾

## 增长数据

| 时间 | 里程碑 |
|------|--------|
| 2025.11 | 首次发布（当时叫 Clawdbot） |
| 2026.1.25 | 正式发布，当天 9,000 GitHub 星标 |
| 2026.2 | 突破 10 万星标；Steinberger 宣布加入 OpenAI |
| 2026.3 | 24 万+星标（36氪），超越 Linux，登顶 GitHub 历史星标榜首 |
| 2026.5 | **375K** 星标，全球 #6，78K forks |

GitHub 历史上开源项目增长最快的纪录。

## 核心能力

三个关键词：**本地运行、全面连接、自主操作**

- **本地优先**：所有日志、记忆、配置以 Markdown/YAML 存储在本地
- **多集成**：WhatsApp、Telegram、Slack、Discord、Teams 等
- **多模型**：Claude、GPT、Gemini、本地模型（Ollama）
- **ClawHub 技能市场**：社区贡献的海量技能
- **Always-On 代理模式**：持续执行
- **底层权限**：操作鼠标键盘、读邮件、写代码、管理文件

## 安全风险（重要）

详见 [[安全与合规风险]]

- 工信部/CNNVD 发布高危安全预警（2026.2.5）
- 2026.1-3 月共 82 个 CVE，超危 12 个、高危 21 个
- Meta AI 安全总监 Summer Yue 使用时 AI 删除数百封邮件，最终物理跑向 Mac mini 终止（SEV1）

**龙虾悖论**：想让它做的事越多 → 权限越大 → 风险越高

## 国内跟进

### 腾讯 WorkBuddy（2026.3.9 发布）
- 定位：全场景 AI 智能体，兼容 OpenClaw 技能生态
- 核心卖点：下载即用，1 分钟配置
- 支持：QQ、企业微信、飞书、钉钉
- 模型：混元、DeepSeek、GLM、Kimi、MiniMax
- 问题：数据经过腾讯服务器，对律所不理想

## 演讲中的定位

在阿成的培训演讲中，OpenClaw 通常作为「引子」——展示智能体的强大能力和真实风险，然后引出 MyAgent 作为更安全可控的方案。

## 相关条目

- [[智能体架构]] — OpenClaw 在三大架构中的对比位置
- [[安全与合规风险]] — 详细的安全风险数据和案例
