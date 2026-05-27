import * as fs from "fs/promises";
import * as path from "path";

export interface PromptContext {
	/** Absolute path to mino workspace (parent of brain/, holds CLAUDE.md + .claude/). */
	workspacePath: string;
	/** Absolute path to the Obsidian vault (usually workspacePath/brain). */
	vaultBase: string;
	/** Friendly vault name (e.g. 'brain'). */
	vaultName: string;
	/** Vault-relative path of file currently open in editor, or null. */
	activeFileVaultPath: string | null;
	/** Currently selected text, or null. */
	selection: {
		text: string;
		fromLine: number;
		toLine: number;
		filePath: string;
	} | null;
}

const IDENTITY_FILES = [
	"CLAUDE.md",
	".claude/rules/01-IDENTITY.md",
	".claude/rules/02-SOUL.md",
	".claude/rules/03-USER.md",
	".claude/rules/04-MEMORY.md",
];

async function safeRead(abs: string): Promise<string | null> {
	try {
		return await fs.readFile(abs, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Build the system prompt for 小皮 inside Obsidian. Combines:
 *  - mino workspace identity files (CLAUDE.md + 04 rules)
 *  - vault context (active file, selection)
 *  - tool-use contract
 */
export async function buildSystemPrompt(ctx: PromptContext): Promise<string> {
	const parts: string[] = [];

	parts.push(
		`# 你是谁\n\n你是小皮 (🦊),DT阿成 的桌面 AI 搭档。当前你正在 Obsidian 的「小皮 Brain Editor」插件里和阿成对话——他在 vault \`${ctx.vaultName}\` 中,你能直接读写他的笔记。\n`
	);

	// Identity files (read what exists; quietly skip the rest)
	const identityChunks: string[] = [];
	for (const rel of IDENTITY_FILES) {
		const abs = path.join(ctx.workspacePath, rel);
		const content = await safeRead(abs);
		if (content) {
			identityChunks.push(`<file path="${rel}">\n${content}\n</file>`);
		}
	}
	if (identityChunks.length > 0) {
		parts.push(`# 你的身份契约 (来自 ${ctx.workspacePath})\n\n${identityChunks.join("\n\n")}`);
	}

	parts.push(
		`# 当前编辑环境\n\n- Vault 根目录 (绝对路径): \`${ctx.vaultBase}\`\n- Vault 名: \`${ctx.vaultName}\`\n- 你的文件操作工具的所有 \`path\` 参数都是 **vault 相对路径** (相对 \`${ctx.vaultBase}\`)。\n${
			ctx.activeFileVaultPath
				? `- 阿成此刻在 Obsidian 里打开的文件: \`${ctx.activeFileVaultPath}\``
				: "- 阿成当前没打开 markdown 文件 (按他指令直接动手即可)。"
		}`
	);

	if (ctx.selection && ctx.selection.text.trim()) {
		const previewText =
			ctx.selection.text.length > 1200
				? ctx.selection.text.slice(0, 1200) + "\n[...truncated]"
				: ctx.selection.text;
		parts.push(
			`# 阿成选中的段落\n\n来源: \`${ctx.selection.filePath}\`,第 ${ctx.selection.fromLine}–${ctx.selection.toLine} 行\n\n\`\`\`\n${previewText}\n\`\`\`\n\n→ 阿成本次指令优先针对这一段。`
		);
	}

	parts.push(
		`# 工作规则\n\n- 你有 \`read_file\` / \`write_file\` / \`edit_file\` / \`list_dir\` / \`grep\` / \`glob\` 六个工具,作用域限定在 vault 内。\n- **改动前先 read_file** 拿到精确文本,再用 edit_file 做局部替换。整文件重写才用 write_file。\n- 改完文件不要把全文贴回回复,Obsidian 会自动重渲染。用一两句话告诉阿成改了什么、改在哪。\n- **可以反问**——指令含糊、目标不清楚、有多种合理改法时,先开口问,不要瞎猜。这是对话不是工单。\n- **简洁直球**:阿成的契约是 02-SOUL.md 里那一套。别"Great question!",别堆词,别复述指令。\n- 涉及结构改动 (拆分/合并/重命名文件) 前先说一句再动手。\n- 如果指令本身有问题 (要改的内容不在文件里、与已有内容矛盾),直接指出。`
	);

	return parts.join("\n\n---\n\n");
}
