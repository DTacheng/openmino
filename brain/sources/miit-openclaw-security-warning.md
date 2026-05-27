---
title: "工信部/CNNVD — OpenClaw 安全漏洞通报"
type: official
url: https://www.cnnvd.org.cn/group1/M00/01/DD/rBBl8WmqTGWAThbsAAru-bm6W0w228.pdf
publisher: 国家信息安全漏洞共享平台（CNNVD）/ 工业和信息化部
date: 2026-02-05
accessed: 2026-04-17
archive: sources/archive/cnnvd-ai-vulnerability-report-2026q2.pdf
tags: [OpenClaw, 安全, CVE, CNNVD, 工信部]
---

# 工信部/CNNVD — OpenClaw 安全漏洞通报

## 关键摘录

### 官方通报（已验证 ✓）

| 来源 | 日期 | 事件 |
|------|------|------|
| CNNVD《人工智能重要漏洞通报（2026年第二期）》 | 2026年 | 包含 OpenClaw 漏洞专题 |
| 工信部网络安全威胁和漏洞信息共享平台 | 2026-02-05 | 发布 OpenClaw 安全风险预警 |
| CNCERT 国家互联网应急中心 | 2026-03-10 | 再次发布 OpenClaw 安全应用风险提示 |

### OpenClaw 漏洞统计（2026年1月—3月9日）

| 危害等级 | 数量 |
|---------|------|
| 超危 | 12个 |
| 高危 | 21个 |
| 中危 | 47个 |
| 低危 | 2个 |
| **合计** | **82个** |

### 漏洞类型分布
- 访问控制错误
- 代码问题
- 路径遍历
- **命令注入**（多项）
- 操作系统命令注入（多项）
- 参数注入
- 跨站脚本
- 信息泄露
- 数据伪造

### 关键 CVE 编号

| 漏洞 | CNNVD编号 | CVE编号 | 危害等级 |
|------|----------|---------|---------|
| OpenClaw 安全漏洞 | CNNVD-202602-3715 | CVE-2026-27002 | 超危 |
| OpenClaw 命令注入 | CNNVD-202602-3716 | CVE-2026-27001 | 高危 |
| OpenClaw 命令注入 | CNNVD-202602-2953 | CVE-2026-26323 | 高危 |
| OpenClaw 参数注入 | CNNVD-202603-666 | CVE-2026-28470 | 超危 |
| OpenClaw 访问控制错误 | CNNVD-202603-738 | CVE-2026-28472 | 超危 |
| OpenClaw 远程代码执行 | — | CVE-2026-28466 | 超危（CVSS 9.8） |
| 令牌泄露/RCE | — | CVE-2026-25253 | 高危（CVSS 8.8） |

### 两个最严重漏洞详情

**CVE-2026-25253 — 认证令牌泄露导致 RCE**
- 影响版本：2026年1月29日之前所有版本
- 修复版本：2026.1.29+
- 技术：URL 参数直接读取 gatewayUrl，携带 authToken 建立 WebSocket，攻击者构造恶意链接即可实现一键 RCE

**CVE-2026-28466 — 令牌轮换越权 + RCE**
- 影响版本：≤2026.3.8
- 修复版本：2026.3.11
- CVSS：9.1-9.8
- 技术：`device.token.rotate` 接口未检查调用者作用域， 普通用户可利用已授权管理员权限设备生成管理员 token

### ⚠️ 未验证项

- **"插件投毒率 10.8%"**：搜索结果中**未找到**工信部或 CNNVD 关于"插件投毒"的具体预警通报。82个漏洞数据已验证，但 10.8% 这个比例无法确认来源。

## 来源

- [CNNVD《人工智能重要漏洞通报（2026年第二期）》PDF](https://www.cnnvd.org.cn/group1/M00/01/DD/rBBl8WmqTGWAThbsAAru-bm6W0w228.pdf)
- [51CTO: OpenClaw多个安全漏洞](https://www.51cto.com/article/837802.html)
- [CSDN: CVE-2026-25253详情](https://blog.csdn.net/sD7O95O/article/details/158105132)
