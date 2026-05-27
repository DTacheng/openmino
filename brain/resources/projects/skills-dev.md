---
title: Skills 开发工作区
description: C:\Users\PC\github\ 下的公开 skill repo 和开发约定
tags: [development, skills, github]
updated: 2026-04-24
location: C:\Users\PC\github
---

# Skills 开发工作区

**路径**：`C:\Users\PC\github\`
**约定**：真实开发在 github/ 下进行，然后通过 junction 链接到 `~/.myagents/skills/`

## 已发布 Skills

### html-ppt-to-pdf
**功能**：将 HTML 格式的 PPT 转换为矢量 PDF（用 Playwright Chromium page.pdf()，不走截图路线）
**解决什么问题**：字体栅格化、页码错、丢页/重页——用 Chromium 矢量输出一步到位
**本地路径**：[`C:\Users\PC\github\html-ppt-to-pdf`](file:///C:/Users/PC/github/html-ppt-to-pdf)
**GitHub**：https://github.com/DTacheng/html-ppt-to-pdf（MIT）
**ClawHub**：https://clawhub.ai/dtacheng/html-ppt-to-pdf
**安装**：`myagents skill add DTacheng/html-ppt-to-pdf`
** junction**：`~/.myagents/skills/html-ppt-to-pdf/` → `C:\Users\PC\github\html-ppt-to-pdf`

### md-to-share
**功能**：Markdown → 长图分享

### slide-editor
**功能**：HTML 幻灯片可视化编辑

## GitHub 仓库

| 仓库 | 说明 |
|------|------|
| `html-ppt-to-pdf` | Skill，MIT License |
| `md-to-share` | 工具 |
| `slide-editor` | 工具 |

## 相关记忆

- [[topics/github-workspace]] — github 工作区管理约定
- [[topics/html-to-pdf]] — html-ppt-to-pdf 深度笔记（含 Windows Playwright bundled Chromium 1208 的 page.pdf() bug 和解法）