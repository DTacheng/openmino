---
title: API 安全调用规范
tags: [API, 安全, 合规]
links: [元典开放平台.md, 安全与合规风险.md]
refs: []
updated: 2026-04-24
---

# API 安全调用规范

## 背景

2026-04-24 与法规核查 Skill 作者交流中，对方对旧版调用方式提出合规质疑，推动我们梳理了 API 调用安全规范。

## 不合规的旧方式

| 问题 | 具体表现 | 风险 |
|------|----------|------|
| 协议 | `http://` 明文传输 | 数据可被中间人拦截 |
| API Key 位置 | 挂在 URL 参数 `?api_key=xxx` | Key 会残留在各类日志中（CDN、nginx、应用、浏览器历史） |
| 端口暴露 | 直接暴露内网端口 `aiapi.ailaw.cn:8319` | 端口扫描风险、无统一鉴权入口 |

旧接口文档（`code/docs/` 目录下的接口文档）记录的即为此种旧方式，已过时。

## 合规的新方式

| 要求 | 实现 | 说明 |
|------|------|------|
| 协议 | `https://` | 全程加密 |
| API Key 传递 | 放在 HTTP Header `X-API-Key` 里 | 不进入 URL，日志不暴露 Key |
| 统一入口 | 通过域名反代（如 `open.chineselaw.com`） | 端口不直接暴露，由网关统一鉴权、限流 |

**示例**（新平台合规方式）：
```
POST https://open.chineselaw.com/open/law_vector_search
Header: X-API-Key: {你的api_key}
Body: application/json
```

## 关键认知

1. **日志泄露是主要风险** — 即使传输层加密，日志层（CDN、nginx、反向代理、应用）会记录 URL，URL 参数形式的 Key 全部可见
2. **合规场景要求** — 等保/密评/行业规范要求 Key 不能出现在 URL 里，必须通过 Header 传递
3. **反代是标准做法** — 所有 API 必须通过统一网关暴露，禁止直接暴露内网服务端口

## 在元典开放平台的体现

| 项目 | 旧平台（已废弃） | 新平台（合规） |
|------|----------------|---------------|
| 协议 | `http://aiapi.ailaw.cn:8319` | `https://open.chineselaw.com` |
| Key 位置 | URL 参数 `?api_key=` | HTTP Header `X-API-Key` |
| 端口 | 直接暴露 8319 | 通过 443 反代，不暴露端口 |

## 相关条目

- [[元典开放平台]] — API 平台现状
- [[安全与合规风险]] — 安全风险汇总
