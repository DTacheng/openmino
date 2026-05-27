import * as fs from "fs/promises";
import * as path from "path";

/**
 * File-operation tools exposed to the AI. All paths are vault-relative and
 * resolved against vaultBase. Any attempt to escape vaultBase is rejected.
 */

export interface ToolContext {
	vaultBase: string;
}

export interface ToolResult {
	content: string;
	is_error?: boolean;
}

export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

/** Anthropic-compatible tool definitions sent to the model. */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
	{
		name: "read_file",
		description:
			"Read a file from the Obsidian vault. Returns the full UTF-8 text contents. Use this before editing any file.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Vault-relative path, e.g. 'brain/sources/foo.md'.",
				},
			},
			required: ["path"],
		},
	},
	{
		name: "write_file",
		description:
			"Create a new file or completely overwrite an existing file with the given content. For partial edits to existing files, use edit_file instead.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Vault-relative path." },
				content: { type: "string", description: "Full UTF-8 content." },
			},
			required: ["path", "content"],
		},
	},
	{
		name: "edit_file",
		description:
			"Replace one exact occurrence of old_string with new_string in an existing file. Fails if old_string is not unique. Always read_file first to copy old_string verbatim, including whitespace.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Vault-relative path." },
				old_string: {
					type: "string",
					description: "Exact text to find. Must occur exactly once.",
				},
				new_string: {
					type: "string",
					description: "Replacement text.",
				},
			},
			required: ["path", "old_string", "new_string"],
		},
	},
	{
		name: "list_dir",
		description:
			"List entries in a directory (non-recursive). Returns filename and type (file/dir) for each entry.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Vault-relative directory path. Use '.' for vault root.",
				},
			},
			required: ["path"],
		},
	},
	{
		name: "grep",
		description:
			"Search for a string or regex pattern across files in the vault. Returns matching lines with file path and line number.",
		input_schema: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "String or regex to search for." },
				path: {
					type: "string",
					description:
						"Vault-relative directory to search in. Defaults to vault root.",
				},
				regex: {
					type: "boolean",
					description: "If true, pattern is treated as JavaScript regex. Default false.",
				},
				glob: {
					type: "string",
					description:
						"Optional filename glob filter, e.g. '*.md'. Default '*.md'.",
				},
			},
			required: ["pattern"],
		},
	},
	{
		name: "glob",
		description:
			"Find files matching a glob pattern under a directory. Returns matching vault-relative paths.",
		input_schema: {
			type: "object",
			properties: {
				pattern: {
					type: "string",
					description: "Glob pattern, e.g. '**/*.md' or 'sources/*.md'.",
				},
				path: {
					type: "string",
					description: "Vault-relative directory to search. Defaults to vault root.",
				},
			},
			required: ["pattern"],
		},
	},
];

/** Resolve a vault-relative path to absolute and verify it stays under vaultBase. */
function resolveSafe(ctx: ToolContext, p: string): string {
	if (typeof p !== "string") {
		throw new Error("path must be a string");
	}
	const cleaned = p.replace(/^[\\/]+/, "").replace(/\\/g, "/");
	const abs = path.resolve(ctx.vaultBase, cleaned === "." ? "" : cleaned);
	const baseResolved = path.resolve(ctx.vaultBase);
	if (abs !== baseResolved && !abs.startsWith(baseResolved + path.sep)) {
		throw new Error(`Path '${p}' escapes vault root.`);
	}
	return abs;
}

function toVaultRel(ctx: ToolContext, abs: string): string {
	const rel = path.relative(ctx.vaultBase, abs);
	return rel.split(path.sep).join("/");
}

/** Convert a glob pattern to a regex (supports **, *, ?). */
function globToRegex(glob: string): RegExp {
	let re = "^";
	let i = 0;
	while (i < glob.length) {
		const c = glob[i];
		if (c === "*") {
			if (glob[i + 1] === "*") {
				re += ".*";
				i += 2;
				if (glob[i] === "/") i++;
			} else {
				re += "[^/]*";
				i++;
			}
		} else if (c === "?") {
			re += "[^/]";
			i++;
		} else if (".+^$()|{}[]\\".includes(c!)) {
			re += "\\" + c;
			i++;
		} else if (c === "/") {
			re += "/";
			i++;
		} else {
			re += c;
			i++;
		}
	}
	re += "$";
	return new RegExp(re);
}

async function walkDir(
	root: string,
	relBase: string,
	out: string[],
	maxEntries = 5000
): Promise<void> {
	if (out.length >= maxEntries) return;
	let entries: import("fs").Dirent[];
	try {
		entries = await fs.readdir(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const ent of entries) {
		if (out.length >= maxEntries) return;
		// Skip hidden + dependency dirs to keep results sane.
		if (ent.name.startsWith(".") || ent.name === "node_modules") continue;
		const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
		const full = path.join(root, ent.name);
		if (ent.isDirectory()) {
			await walkDir(full, rel, out, maxEntries);
		} else if (ent.isFile()) {
			out.push(rel);
		}
	}
}

export async function executeTool(
	ctx: ToolContext,
	name: string,
	input: Record<string, any>
): Promise<ToolResult> {
	try {
		switch (name) {
			case "read_file": {
				const abs = resolveSafe(ctx, input.path);
				const text = await fs.readFile(abs, "utf-8");
				// Cap to avoid blowing context; warn if truncated.
				const MAX = 80_000;
				if (text.length > MAX) {
					return {
						content:
							text.slice(0, MAX) +
							`\n\n[...truncated: file is ${text.length} chars, showed first ${MAX}]`,
					};
				}
				return { content: text };
			}
			case "write_file": {
				const abs = resolveSafe(ctx, input.path);
				if (typeof input.content !== "string") {
					return { content: "content must be a string", is_error: true };
				}
				await fs.mkdir(path.dirname(abs), { recursive: true });
				await fs.writeFile(abs, input.content, "utf-8");
				return { content: `Wrote ${input.content.length} chars to ${input.path}` };
			}
			case "edit_file": {
				const abs = resolveSafe(ctx, input.path);
				if (typeof input.old_string !== "string" || typeof input.new_string !== "string") {
					return {
						content: "old_string and new_string must be strings",
						is_error: true,
					};
				}
				if (input.old_string === input.new_string) {
					return {
						content: "old_string and new_string are identical — no edit applied.",
						is_error: true,
					};
				}
				const existing = await fs.readFile(abs, "utf-8");
				const idx = existing.indexOf(input.old_string);
				if (idx === -1) {
					return {
						content: `old_string not found in ${input.path}. Read the file again to copy the exact text.`,
						is_error: true,
					};
				}
				const lastIdx = existing.lastIndexOf(input.old_string);
				if (lastIdx !== idx) {
					return {
						content: `old_string occurs multiple times in ${input.path}. Add more surrounding context to make it unique.`,
						is_error: true,
					};
				}
				const updated =
					existing.slice(0, idx) +
					input.new_string +
					existing.slice(idx + input.old_string.length);
				await fs.writeFile(abs, updated, "utf-8");
				const oldLines = input.old_string.split("\n").length;
				const newLines = input.new_string.split("\n").length;
				return {
					content: `Edited ${input.path}: replaced ${oldLines} line(s) → ${newLines} line(s).`,
				};
			}
			case "list_dir": {
				const abs = resolveSafe(ctx, input.path ?? ".");
				const entries = await fs.readdir(abs, { withFileTypes: true });
				const lines = entries
					.filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
					.map((e) => `${e.isDirectory() ? "dir " : "file"}  ${e.name}`)
					.sort();
				return {
					content: lines.length
						? lines.join("\n")
						: "(empty directory)",
				};
			}
			case "grep": {
				const pattern: string = input.pattern;
				if (typeof pattern !== "string" || !pattern) {
					return { content: "pattern is required", is_error: true };
				}
				const useRegex = !!input.regex;
				const filenameGlob: string = input.glob ?? "*.md";
				const searchRoot = resolveSafe(ctx, input.path ?? ".");
				const matcher = useRegex
					? new RegExp(pattern)
					: null;
				const fnameRe = globToRegex(filenameGlob);
				const files: string[] = [];
				await walkDir(searchRoot, "", files);
				const hits: string[] = [];
				const MAX_HITS = 200;
				for (const rel of files) {
					if (!fnameRe.test(path.basename(rel))) continue;
					const abs = path.join(searchRoot, rel);
					let text: string;
					try {
						text = await fs.readFile(abs, "utf-8");
					} catch {
						continue;
					}
					const lines = text.split("\n");
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i] ?? "";
						const match = matcher ? matcher.test(line) : line.includes(pattern);
						if (match) {
							const dispPath = toVaultRel(ctx, path.join(searchRoot, rel));
							hits.push(`${dispPath}:${i + 1}: ${line.trim().slice(0, 200)}`);
							if (hits.length >= MAX_HITS) break;
						}
					}
					if (hits.length >= MAX_HITS) break;
				}
				return {
					content: hits.length
						? hits.join("\n") +
						  (hits.length >= MAX_HITS ? `\n[...truncated at ${MAX_HITS} hits]` : "")
						: "(no matches)",
				};
			}
			case "glob": {
				const pattern: string = input.pattern;
				if (typeof pattern !== "string" || !pattern) {
					return { content: "pattern is required", is_error: true };
				}
				const searchRoot = resolveSafe(ctx, input.path ?? ".");
				const files: string[] = [];
				await walkDir(searchRoot, "", files);
				const re = globToRegex(pattern);
				const rootRel = toVaultRel(ctx, searchRoot);
				const matched = files
					.filter((rel) => re.test(rel))
					.map((rel) => (rootRel ? `${rootRel}/${rel}` : rel));
				return {
					content: matched.length
						? matched.slice(0, 500).join("\n") +
						  (matched.length > 500 ? `\n[...${matched.length - 500} more]` : "")
						: "(no matches)",
				};
			}
			default:
				return { content: `Unknown tool: ${name}`, is_error: true };
		}
	} catch (e: any) {
		return { content: `Tool error: ${e?.message ?? String(e)}`, is_error: true };
	}
}
