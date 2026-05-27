import { ItemView, WorkspaceLeaf, Notice, MarkdownView, TFile } from "obsidian";
import XiaopiPlugin, { SelectionSnapshot } from "./main";
import type { AgentLoopHandlers, ContentBlock } from "./llmClient";

export const VIEW_TYPE_XIAOPI = "xiaopi-chat";

interface ToolCallUI {
	id: string;
	name: string;
	status: "running" | "done" | "error";
	summary: string;
	el: HTMLElement;
}

interface AssistantTurnUI {
	turnEl: HTMLElement;
	bodyEl: HTMLElement; // streaming text container
	textBuffer: string;
	tools: Map<string, ToolCallUI>;
}

export class XiaopiView extends ItemView {
	plugin: XiaopiPlugin;
	private isBusy = false;
	private pinnedSelection: SelectionSnapshot | null = null;
	private currentAssistantTurn: AssistantTurnUI | null = null;

	private historyEl!: HTMLElement;
	private contextEl!: HTMLElement;
	private selectionEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private statusEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: XiaopiPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_XIAOPI;
	}
	getDisplayText() {
		return "小皮 Brain Editor";
	}
	getIcon() {
		return "message-circle";
	}

	async onOpen() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("xiaopi-view");

		const header = root.createDiv({ cls: "xiaopi-header" });
		header.createEl("div", { cls: "xiaopi-title", text: "🦊 小皮" });
		this.statusEl = header.createEl("div", { cls: "xiaopi-status", text: "待机" });

		this.contextEl = root.createDiv({ cls: "xiaopi-context" });
		this.historyEl = root.createDiv({ cls: "xiaopi-history" });
		this.selectionEl = root.createDiv({ cls: "xiaopi-selection" });

		const inputBox = root.createDiv({ cls: "xiaopi-input-box" });
		this.inputEl = inputBox.createEl("textarea", {
			cls: "xiaopi-input",
			attr: {
				placeholder: "和小皮说话 ✍️\n(Enter 发送,Shift+Enter 换行)",
				rows: "4",
			},
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				this.send();
			}
		});
		this.inputEl.addEventListener("focus", () => {
			if (!this.pinnedSelection) {
				const snap = this.plugin.captureSelection();
				if (snap) {
					this.pinnedSelection = snap;
					this.renderSelectionChip();
				}
			}
		});

		const btnRow = inputBox.createDiv({ cls: "xiaopi-btn-row" });

		const pinBtn = btnRow.createEl("button", { text: "📌 锁定选区" });
		pinBtn.title = "把当前编辑器选中文本作为本轮目标";
		pinBtn.addEventListener("click", () => {
			const snap = this.plugin.captureSelection();
			if (!snap) {
				new Notice("当前没有选中任何文本。");
				return;
			}
			this.pinnedSelection = snap;
			this.renderSelectionChip();
			new Notice("已锁定选中段落。");
		});

		this.sendBtn = btnRow.createEl("button", { cls: "mod-cta", text: "派发给小皮" });
		this.sendBtn.addEventListener("click", () => this.send());

		const resetBtn = btnRow.createEl("button", { text: "↻ 新会话" });
		resetBtn.title = "清空对话历史";
		resetBtn.addEventListener("click", () => {
			if (this.isBusy) {
				new Notice("小皮还在干活,等她忙完再重置。");
				return;
			}
			this.plugin.history = [];
			this.onHistoryReset();
			new Notice("会话已重置。");
		});

		this.refreshContext();
		this.renderSelectionChip();

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.refreshContext())
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => this.refreshContext())
		);
	}

	async onClose() {
		// nothing — keep history in plugin.history for now.
	}

	setPinnedSelection(snap: SelectionSnapshot | null) {
		this.pinnedSelection = snap;
		this.renderSelectionChip();
	}

	setInputText(text: string) {
		this.inputEl.value = text;
	}

	focusInput() {
		this.inputEl.focus();
	}

	onHistoryReset() {
		this.historyEl.empty();
		this.pinnedSelection = null;
		this.renderSelectionChip();
		this.currentAssistantTurn = null;
		this.setStatus("已重置");
	}

	private refreshContext() {
		this.contextEl.empty();
		const file = this.getActiveMdFile();
		if (file) {
			this.contextEl.createEl("div", {
				cls: "xiaopi-context-file",
				text: `📄 ${file.path}`,
			});
		} else {
			this.contextEl.createEl("div", {
				cls: "xiaopi-context-empty",
				text: "(当前没打开 markdown 文件——小皮会按指令直接动手)",
			});
		}
		const turnCount = this.plugin.history.length;
		this.contextEl.createEl("div", {
			cls: "xiaopi-context-task",
			text: turnCount === 0 ? "🧵 新会话" : `🧵 已有 ${turnCount} 轮对话`,
		});
	}

	private renderSelectionChip() {
		this.selectionEl.empty();
		const snap = this.pinnedSelection;
		if (!snap) return;
		const chip = this.selectionEl.createDiv({ cls: "xiaopi-selection-chip" });
		const meta = chip.createDiv({ cls: "xiaopi-selection-meta" });
		meta.createSpan({
			text: `🎯 已锁定 ${snap.filePath} (第 ${snap.fromLine}–${snap.toLine} 行,${snap.text.length} 字)`,
		});
		const clearBtn = meta.createEl("button", { text: "×" });
		clearBtn.title = "清除锁定";
		clearBtn.addEventListener("click", () => {
			this.pinnedSelection = null;
			this.renderSelectionChip();
		});
		const preview = snap.text.length > 200 ? snap.text.slice(0, 200) + "…" : snap.text;
		chip.createDiv({ cls: "xiaopi-selection-preview", text: preview });
	}

	private getActiveMdFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ?? null;
	}

	// ---------------------------------------------------------------------
	// Chat rendering
	// ---------------------------------------------------------------------

	private addUserTurn(text: string, selection: SelectionSnapshot | null) {
		const turnEl = this.historyEl.createDiv({ cls: "xiaopi-turn xiaopi-turn-user" });
		const head = turnEl.createDiv({ cls: "xiaopi-turn-head" });
		head.createSpan({ cls: "xiaopi-turn-role", text: "你" });
		head.createSpan({
			cls: "xiaopi-turn-ts",
			text: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
		});
		if (selection && selection.text.trim()) {
			const sel = turnEl.createDiv({ cls: "xiaopi-turn-selection" });
			sel.createSpan({
				text: `🎯 ${selection.filePath} L${selection.fromLine}-${selection.toLine}`,
			});
		}
		turnEl.createDiv({ cls: "xiaopi-turn-body", text: text });
		this.scrollToBottom();
	}

	private addSystemTurn(text: string, kind: "info" | "error" = "info") {
		const turnEl = this.historyEl.createDiv({
			cls: `xiaopi-turn xiaopi-turn-system xiaopi-turn-${kind}`,
		});
		const head = turnEl.createDiv({ cls: "xiaopi-turn-head" });
		head.createSpan({ cls: "xiaopi-turn-role", text: "系统" });
		head.createSpan({
			cls: "xiaopi-turn-ts",
			text: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
		});
		const prefix = kind === "error" ? "❌ " : "ℹ️ ";
		turnEl.createDiv({ cls: "xiaopi-turn-body", text: prefix + text });
		this.scrollToBottom();
	}

	private startAssistantTurn(): AssistantTurnUI {
		const turnEl = this.historyEl.createDiv({
			cls: "xiaopi-turn xiaopi-turn-assistant",
		});
		const head = turnEl.createDiv({ cls: "xiaopi-turn-head" });
		head.createSpan({ cls: "xiaopi-turn-role", text: "🦊 小皮" });
		head.createSpan({
			cls: "xiaopi-turn-ts",
			text: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
		});
		const bodyEl = turnEl.createDiv({ cls: "xiaopi-turn-body xiaopi-streaming" });
		this.scrollToBottom();
		return {
			turnEl,
			bodyEl,
			textBuffer: "",
			tools: new Map(),
		};
	}

	private ensureAssistantTurn(): AssistantTurnUI {
		if (!this.currentAssistantTurn) {
			this.currentAssistantTurn = this.startAssistantTurn();
		}
		return this.currentAssistantTurn;
	}

	private appendAssistantText(text: string) {
		const turn = this.ensureAssistantTurn();
		turn.textBuffer += text;
		turn.bodyEl.setText(turn.textBuffer);
		this.scrollToBottom();
	}

	private addToolCall(name: string, id: string) {
		const turn = this.ensureAssistantTurn();
		const el = turn.turnEl.createDiv({ cls: "xiaopi-tool xiaopi-tool-running" });
		const head = el.createDiv({ cls: "xiaopi-tool-head" });
		head.createSpan({ cls: "xiaopi-tool-icon", text: "🔧" });
		head.createSpan({ cls: "xiaopi-tool-name", text: name });
		head.createSpan({ cls: "xiaopi-tool-status", text: "执行中…" });
		el.createDiv({ cls: "xiaopi-tool-summary" });
		turn.tools.set(id, { id, name, status: "running", summary: "", el });
		this.scrollToBottom();
	}

	private completeToolCall(
		id: string,
		input: Record<string, any>,
		result: { content: string; is_error?: boolean }
	) {
		const turn = this.ensureAssistantTurn();
		const tool = turn.tools.get(id);
		if (!tool) return;
		tool.status = result.is_error ? "error" : "done";
		tool.summary = summarizeToolCall(tool.name, input, result);
		tool.el.removeClass("xiaopi-tool-running");
		tool.el.addClass(result.is_error ? "xiaopi-tool-error" : "xiaopi-tool-done");
		const statusEl = tool.el.querySelector(".xiaopi-tool-status") as HTMLElement | null;
		if (statusEl) statusEl.setText(result.is_error ? "失败" : "✓");
		const summaryEl = tool.el.querySelector(".xiaopi-tool-summary") as HTMLElement | null;
		if (summaryEl) summaryEl.setText(tool.summary);
	}

	private finalizeAssistantTurn() {
		if (this.currentAssistantTurn) {
			this.currentAssistantTurn.bodyEl.removeClass("xiaopi-streaming");
			this.currentAssistantTurn = null;
		}
	}

	private scrollToBottom() {
		// requestAnimationFrame so newly created elements are laid out first.
		requestAnimationFrame(() => {
			this.historyEl.scrollTop = this.historyEl.scrollHeight;
		});
	}

	setStatus(text: string) {
		this.statusEl.setText(text);
	}

	setBusy(busy: boolean) {
		this.isBusy = busy;
		this.sendBtn.disabled = busy;
		this.inputEl.disabled = busy;
		this.sendBtn.setText(busy ? "对话中…" : "派发给小皮");
	}

	/** Build the handler bundle for the agent loop. */
	makeAgentHandlers(): AgentLoopHandlers {
		// Track the most recent tool's input so onToolResult can render it nicely.
		const lastInputForId = new Map<string, Record<string, any>>();
		return {
			onTextDelta: (text) => this.appendAssistantText(text),
			onToolUseStart: (name, id) => this.addToolCall(name, id),
			onToolUseComplete: (_name, id, input) => {
				lastInputForId.set(id, input);
			},
			onToolResult: (_name, id, result) => {
				const input = lastInputForId.get(id) ?? {};
				this.completeToolCall(id, input, result);
			},
			onAssistantTurnComplete: (content: ContentBlock[], stopReason) => {
				// If the model stops without text (e.g. ended right after tools),
				// add a placeholder so the user knows the turn finalized.
				const hasText = content.some(
					(b) => b.type === "text" && b.text.trim().length > 0
				);
				if (!hasText && stopReason !== "tool_use") {
					this.appendAssistantText("(小皮没说话,直接收工了)");
				}
				if (stopReason !== "tool_use") {
					this.finalizeAssistantTurn();
				}
			},
			onError: (message) => {
				this.finalizeAssistantTurn();
				this.addSystemTurn(message, "error");
			},
		};
	}

	async send() {
		if (this.isBusy) return;
		const msg = this.inputEl.value.trim();
		if (!msg) return;
		this.inputEl.value = "";
		const selection = this.pinnedSelection ?? this.plugin.captureSelection();
		this.addUserTurn(msg, selection);
		this.setBusy(true);
		this.setStatus("小皮思考中…");
		try {
			await this.plugin.runTurn(msg, this, selection);
			this.setStatus("待机");
			// Selection is consumed after dispatch — fresh turn = fresh target.
			this.pinnedSelection = null;
			this.renderSelectionChip();
		} catch (e: any) {
			console.error("[xiaopi] runTurn failed", e);
			this.addSystemTurn(e?.message ?? String(e), "error");
			this.setStatus("出错");
			new Notice(`小皮出错:${e?.message ?? e}`);
		} finally {
			this.setBusy(false);
			this.refreshContext();
		}
	}
}

/** Short human summary of a tool call for the chat UI. */
function summarizeToolCall(
	name: string,
	input: Record<string, any>,
	result: { content: string; is_error?: boolean }
): string {
	if (result.is_error) {
		return `${name}: ${truncate(result.content, 200)}`;
	}
	switch (name) {
		case "read_file":
			return `📖 读 ${input.path} (${result.content.length} 字)`;
		case "write_file":
			return `✏️ 写 ${input.path}`;
		case "edit_file":
			return `✂️ 改 ${input.path}: ${truncate(result.content, 100)}`;
		case "list_dir":
			return `📂 列 ${input.path ?? "."} (${result.content.split("\n").length} 项)`;
		case "grep":
			return `🔍 grep "${truncate(input.pattern ?? "", 40)}" → ${
				result.content === "(no matches)"
					? "0 命中"
					: result.content.split("\n").length + " 行"
			}`;
		case "glob":
			return `🗂️ glob "${input.pattern}" → ${
				result.content === "(no matches)"
					? "0 个"
					: result.content.split("\n").length + " 个文件"
			}`;
		default:
			return truncate(result.content, 150);
	}
}

function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return s.slice(0, n) + "…";
}
