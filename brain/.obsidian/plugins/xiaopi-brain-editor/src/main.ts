import {
	App,
	Editor,
	FileSystemAdapter,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	Setting,
	TFile,
} from "obsidian";
import * as path from "path";
import {
	DEFAULT_SETTINGS,
	XiaopiSettings,
	XiaopiSettingTab,
} from "./settings";
import { VIEW_TYPE_XIAOPI, XiaopiView } from "./view";
import {
	loadProviders,
	runAgentLoop,
	type ChatMessage,
	type ContentBlock,
	type ProviderInfo,
} from "./llmClient";
import { buildSystemPrompt } from "./systemPrompt";
import { executeTool, type ToolContext } from "./tools";

export interface SelectionSnapshot {
	text: string;
	fromLine: number; // 1-based
	toLine: number; // 1-based
	filePath: string; // vault-relative
}

export default class XiaopiPlugin extends Plugin {
	settings!: XiaopiSettings;
	/** Conversation history shared across turns until user resets. */
	history: ChatMessage[] = [];

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_XIAOPI, (leaf) => new XiaopiView(leaf, this));

		this.addRibbonIcon("message-circle", "打开小皮 Brain Editor", () =>
			this.activateView()
		);

		this.addCommand({
			id: "open-xiaopi-panel",
			name: "打开小皮 Brain Editor 面板",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "reset-xiaopi-session",
			name: "重置小皮会话 (清空对话历史)",
			callback: () => {
				this.history = [];
				const view = this.getXiaopiView();
				view?.onHistoryReset();
				new Notice("小皮会话已重置。");
			},
		});

		this.addCommand({
			id: "edit-selection-with-xiaopi",
			name: "让小皮改选中段",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const snap = this.snapshotFromEditor(editor, view);
				if (!snap) {
					new Notice("没有选中任何文本——先在编辑器里选一段。");
					return;
				}
				new EditSelectionModal(this.app, snap, async (instruction) => {
					await this.activateView();
					const panel = this.getXiaopiView();
					if (!panel) {
						new Notice("打不开小皮面板。");
						return;
					}
					panel.setPinnedSelection(snap);
					panel.setInputText(instruction);
					panel.focusInput();
					panel.send();
				}).open();
			},
		});

		this.addCommand({
			id: "pin-selection-to-xiaopi",
			name: "把选中段锁定到小皮面板",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const snap = this.snapshotFromEditor(editor, view);
				if (!snap) {
					new Notice("没有选中任何文本。");
					return;
				}
				this.activateView().then(() => {
					const panel = this.getXiaopiView();
					if (panel) {
						panel.setPinnedSelection(snap);
						panel.focusInput();
						new Notice("已锁定到小皮面板。");
					}
				});
			},
		});

		this.addSettingTab(new XiaopiSettingTab(this.app, this));
	}

	async onunload() {
		// Best practice: don't detach leaves here.
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<XiaopiSettings>
		);
		// Auto-default workspacePath = parent of vault (works for brain inside mino).
		if (!this.settings.workspacePath) {
			const vaultPath = this.getVaultBasePath();
			if (vaultPath) {
				this.settings.workspacePath = path.dirname(vaultPath);
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getVaultBasePath(): string | null {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return null;
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_XIAOPI)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE_XIAOPI, active: true });
			leaf = right;
		}
		workspace.revealLeaf(leaf);
	}

	private getXiaopiView(): XiaopiView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_XIAOPI);
		return (leaves[0]?.view as XiaopiView) ?? null;
	}

	captureSelection(): SelectionSnapshot | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return null;
		return this.snapshotFromEditor(view.editor, view);
	}

	private snapshotFromEditor(
		editor: Editor,
		view: MarkdownView
	): SelectionSnapshot | null {
		const text = editor.getSelection();
		if (!text || !text.trim()) return null;
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		return {
			text,
			fromLine: from.line + 1,
			toLine: to.line + 1,
			filePath: view.file?.path ?? "(未保存文件)",
		};
	}

	/** Drive one user turn through the agent loop. */
	async runTurn(
		userMessage: string,
		view: XiaopiView,
		selection: SelectionSnapshot | null
	): Promise<void> {
		// 1. Resolve provider/model.
		if (!this.settings.providerId || !this.settings.model) {
			throw new Error("还没在设置里选 LLM Provider 和 Model。");
		}
		const providers = await loadProviders();
		const provider = providers.find((p) => p.id === this.settings.providerId);
		if (!provider) {
			throw new Error(
				`Provider ${this.settings.providerId} 在 MyAgents config 里找不到 (可能被删了或验证状态变 invalid)。`
			);
		}

		// 2. Resolve paths.
		const vaultBase = this.getVaultBasePath();
		if (!vaultBase) {
			throw new Error("当前 vault 不是本地文件系统,小皮没法读写。");
		}
		const workspacePath = this.settings.workspacePath || path.dirname(vaultBase);

		// 3. Build system prompt with current vault context.
		const activeFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
		const system = await buildSystemPrompt({
			workspacePath,
			vaultBase,
			vaultName: this.app.vault.getName(),
			activeFileVaultPath: selection?.filePath ?? activeFile?.path ?? null,
			selection: selection
				? {
						text: selection.text,
						fromLine: selection.fromLine,
						toLine: selection.toLine,
						filePath: selection.filePath,
					}
				: null,
		});

		// 4. Build user message. Wrap selection inline so model sees it in
		//    the conversation transcript (not just system prompt).
		const userBlocks: ContentBlock[] = [
			{
				type: "text",
				text: composeUserText(userMessage, selection),
			},
		];
		this.history.push({ role: "user", content: userBlocks });

		// 5. Set up tool execution.
		const toolCtx: ToolContext = { vaultBase };
		const editedFiles = new Set<string>();

		// 6. Run the loop.
		await runAgentLoop({
			provider,
			model: this.settings.model,
			system,
			messages: this.history,
			executeTool: async (name, input) => {
				const result = await executeTool(toolCtx, name, input);
				if (!result.is_error && (name === "write_file" || name === "edit_file")) {
					if (typeof input.path === "string") {
						editedFiles.add(input.path);
					}
				}
				return result;
			},
			handlers: view.makeAgentHandlers(),
			maxTurns: this.settings.maxTurns,
			maxTokens: this.settings.maxTokens,
		});

		// 7. Refresh edited files in Obsidian.
		for (const rel of editedFiles) {
			await this.nudgeFileReload(rel);
		}
	}

	private async nudgeFileReload(vaultRelPath: string) {
		try {
			// Touch via adapter to flush cache; Obsidian's file watcher will pick up.
			await this.app.vault.adapter.read(vaultRelPath);
		} catch {
			/* best-effort */
		}
	}
}

function composeUserText(
	userMessage: string,
	selection: SelectionSnapshot | null
): string {
	if (!selection || !selection.text.trim()) {
		return userMessage;
	}
	return [
		`<selection file="${selection.filePath}" lines="${selection.fromLine}-${selection.toLine}">`,
		selection.text,
		`</selection>`,
		"",
		userMessage,
	].join("\n");
}

/** Modal for the "让小皮改选中段" quick command. */
class EditSelectionModal extends Modal {
	private selection: SelectionSnapshot;
	private onSubmit: (instruction: string) => void;
	private instruction = "";

	constructor(
		app: App,
		selection: SelectionSnapshot,
		onSubmit: (instruction: string) => void
	) {
		super(app);
		this.selection = selection;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "让小皮改这一段" });

		const meta = contentEl.createDiv({ cls: "xiaopi-modal-meta" });
		meta.setText(
			`📄 ${this.selection.filePath} · 第 ${this.selection.fromLine}–${this.selection.toLine} 行 · ${this.selection.text.length} 字`
		);

		const preview = contentEl.createEl("pre", { cls: "xiaopi-modal-preview" });
		const previewText =
			this.selection.text.length > 400
				? this.selection.text.slice(0, 400) + "\n…"
				: this.selection.text;
		preview.setText(previewText);

		new Setting(contentEl)
			.setName("告诉小皮怎么改")
			.setDesc("Cmd/Ctrl+Enter 直接派发")
			.addTextArea((ta) => {
				ta.inputEl.rows = 4;
				ta.inputEl.style.width = "100%";
				ta.inputEl.placeholder = "例如:把这一段语气改直接,去掉客套话";
				ta.onChange((v) => (this.instruction = v));
				ta.inputEl.addEventListener("keydown", (e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
						e.preventDefault();
						this.submit();
					}
				});
				setTimeout(() => ta.inputEl.focus(), 0);
			});

		const btnRow = contentEl.createDiv({ cls: "xiaopi-modal-btns" });
		const submit = btnRow.createEl("button", { cls: "mod-cta", text: "派发" });
		submit.addEventListener("click", () => this.submit());
		const cancel = btnRow.createEl("button", { text: "取消" });
		cancel.addEventListener("click", () => this.close());
	}

	private submit() {
		const t = this.instruction.trim();
		if (!t) {
			new Notice("先说一句你要怎么改。");
			return;
		}
		this.close();
		this.onSubmit(t);
	}

	onClose() {
		this.contentEl.empty();
	}
}
