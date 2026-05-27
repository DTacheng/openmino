# OpenMino

原创 AI Agent Skill 集合。由小飞和阿成共同维护。

每个 skill 遵循统一结构：`SKILL.md` 做主入口 + `references/` 放参考资料 + `scripts/` 放可执行工具。

## Skill 列表

| Skill | 用途 | 版本 |
|---|---|---|
| [wechat-article-layout-pitfalls](./.claude/skills/wechat-article-layout-pitfalls/) | 公众号推文 HTML/SVG 排版避坑速查 | 0.1.0 |

## Skill 结构

```
skill-name/
├── SKILL.md              # 主入口 + 触发条件 + 速查
├── CHANGELOG.md           # 版本记录
├── references/            # 参考资料（按需）
└── scripts/               # 可执行工具（按需）
```

## 安装

将 skill 目录复制到你的 Agent 工作区的 `.claude/skills/` 下即可。

```bash
git clone https://github.com/hAcKlyc/openmino.git
cp -r openmino/.claude/skills/wechat-article-layout-pitfalls /path/to/your-agent/.claude/skills/
```

## 新建 Skill

参考 [skeleton/](./skeleton/) 模板快速起步。

## License

MIT