---
title: openwork
description: 中台桌面应用项目，含源码(openwork-dev)和编译后的exe(openwork)
tags: [project, desktop-app]
updated: 2026-04-24
location: D:\BaiduSyncdisk\产品经理
---

# openwork

> 中台/桌面应用产品。openwork-dev/ 是源码，openwork/ 是编译后的exe。

## 关系

| 目录 | 内容 | 大小 |
|------|------|------|
| `openwork-dev/` | **源码**（TypeScript/Node.js，pnpm workspace） | 2.3M |
| `openwork/` | **编译后的exe**（opencode/owpenbot/openwork-server/openwork） | 381.9M |

openwork-dev 是源码，openwork 目录包含编译后的可执行文件。

## 源码结构（openwork-dev/）

```
openwork-dev/
├── packages/        pnpm workspace 包
├── opencode/        OpenCode 相关
├── scripts/         构建脚本
├── packaging/       打包配置
├── AGENTS.md        Agent 配置
├── ARCHITECTURE.md  架构文档
├── PRODUCT.md       产品文档
├── README.md
└── node_modules/
```

## 编译产物（openwork/）

| 文件 | 大小 | 说明 |
|------|------|------|
| `opencode.exe` | 150M | OpenCode 主程序 |
| `owpenbot.exe` | 113.5M | 开放机器人 |
| `openwork-server.exe` | 108.2M | 服务端 |
| `openwork.exe` | 8M | 主程序 |
| `Uninstall OpenWork.lnk` | — | 卸载快捷方式 |

## 状态

**最后更新**：2026-01-31，未知是否还在活跃开发。

## 相关

- [[projects/元力工厂]] — 元力工厂是法律AI产品主线，openwork是独立的中台应用