---
title: 法律 Skill 分类体系
tags: [skill, 分类, 框架]
links: [法律元力产品.md]
sources:
  - D:\BaiduSyncdisk\产品经理\元力工厂-For.Agents\法律元力\product\exploration\legal-skill-creator\references\skill_categories.md
  - D:\BaiduSyncdisk\产品经理\元力工厂-For.Agents\法律元力\product\exploration\legal-skill-creator\references\user_identity_types.md
  - D:\BaiduSyncdisk\产品经理\元力工厂-For.Agents\法律元力\product\exploration\legal-skill-creator\references\legal_workflows.md
updated: 2026-04-17
---

# 法律 Skill 分类体系

## Skill 创建框架

法律元力有一套完整的 Skill 创建元技能（legal-skill-creator），包含 450+ 行的 SKILL.md 指南和 74KB 的参考资料库。

**框架位置**：`法律元力/product/exploration/legal-skill-creator/`

## Skill 类型分类

| 类型 | 说明 | 代表 Skill |
|------|------|-----------|
| 法律检索类 | 法条查询、案例检索、报告生成 | 元典法律检索 |
| 合同审查类 | 红绿灯风险标记、Redline 对比 | 合同审查（四层检查版） |
| 文书生成类 | 起诉状、答辩状、代理词等 | 泛法律文书生成器 |
| 合规检查类 | 法规遵从性检查 | — |
| 风险评估类 | 风险矩阵、可视化 | 法律风险可视化 |

## 用户身份分类（5 种）

Skill 设计时需要考虑目标用户的身份特征，不同身份的需求差异显著：

1. **律师** — 最活跃的 AI 使用者，关注效率和专业度
2. **法务** — 关注系统建设，合同审核需求最大
3. **法学生/研究者** — 关注学习和研究辅助
4. **企业管理者** — 关注合规风险管理
5. **普通公民** — 关注法律咨询和自助服务

## 工作流模板（5 大类）

Skill 的核心是工作流设计：

1. **检索工作流**：问题理解 → 检索策略 → 执行检索 → 结果整合 → 报告生成
2. **审查工作流**：文档解析 → 逐条检查 → 风险标注 → 修改建议 → 审查报告
3. **生成工作流**：需求收集 → 模板选择 → 内容填充 → 格式化 → 交付
4. **分析工作流**：数据收集 → 多维分析 → 可视化 → 洞见提炼
5. **合规工作流**：法规识别 → 对标检查 → 差距分析 → 整改建议

## 参考资料库索引

| 文件 | 大小 | 内容 |
|------|------|------|
| chinese_legal_hierarchy.md | 14KB | 中国法律渊源完整分类 |
| legal_workflows.md | 9.7KB | 5 大类工作流模板 |
| legal_output_patterns.md | 17KB | 法律文档输出规范 |
| skill_categories.md | 12KB | 法律 Skill 分类体系 |
| user_identity_types.md | 12KB | 5 种用户身份定义 |

**完整路径**：`法律元力/product/exploration/legal-skill-creator/references/`

## 相关条目

- [[法律元力产品]] — 这些 Skill 的发布平台
