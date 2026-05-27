import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import XiaopiPlugin from "./main";
import { loadProviders, type ProviderInfo } from "./llmClient";

export interface XiaopiSettings {
	/** Provider id from MyAgents config (e.g. 'deepseek', 'custom-xxx'). */
	providerId: string;
	/** Specific model id within the provider. */
	model: string;
	/**
	 * Absolute path to mino workspace (parent of brain/, holds CLAUDE.md +
	 * .claude/rules/). If empty, defaults to the vault's parent directory at
	 * runtime (see main.ts loadSettings).
	 */
	workspacePath: string;
	/** Max turns in the tool-use loop before forced stop. */
	maxTurns: number;
	/** Max tokens per LLM response. */
	maxTokens: number;
}

export const DEFAULT_SETTINGS: XiaopiSettings = {
	providerId: "",
	model: "",
	workspacePath: "",
	maxTurns: 15,
	maxTokens: 4096,
};

export class XiaopiSettingTab extends PluginSettingTab {
	plugin: XiaopiPlugin;
	private providers: ProviderInfo[] = [];
	private loadError: string | null = null;

	constructor(app: App, plugin: XiaopiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "小皮 Brain Editor" });
		containerEl.createEl("p", {
			text: "小皮直接调用 MyAgents 里配好的 LLM Provider,通过工具调用读写当前 vault 的笔记。",
		});

		// Load providers from MyAgents config on each display.
		try {
			this.providers = await loadProviders();
			this.loadError = null;
		} catch (e: any) {
			this.providers = [];
			this.loadError = e?.message ?? String(e);
		}

		if (this.loadError) {
			const warn = containerEl.createEl("div", { cls: "xiaopi-settings-warn" });
			warn.setText(`⚠️ 读取 ~/.myagents/config.json 失败: ${this.loadError}`);
		} else if (this.providers.length === 0) {
			const warn = containerEl.createEl("div", { cls: "xiaopi-settings-warn" });
			warn.setText(
				"⚠️ 在 MyAgents config 里没找到可用的 provider (需要有 baseUrl + API Key + 验证通过)。先去 MyAgents 设置里配一个。"
			);
		}

		// --- Provider picker ---
		const currentProviderId = this.plugin.settings.providerId;
		new Setting(containerEl)
			.setName("LLM Provider")
			.setDesc("从 MyAgents 里已配好的 provider 里选一个 (Anthropic API 兼容的)。")
			.addDropdown((dd) => {
				dd.addOption("", "— 请选择 —");
				for (const p of this.providers) {
					dd.addOption(p.id, `${p.name} (${p.id})`);
				}
				dd.setValue(currentProviderId || "");
				dd.onChange(async (v) => {
					this.plugin.settings.providerId = v;
					// Auto-pick primary model when provider changes.
					const p = this.providers.find((x) => x.id === v);
					if (p) {
						this.plugin.settings.model =
							p.primaryModel || p.models[0]?.model || "";
					} else {
						this.plugin.settings.model = "";
					}
					await this.plugin.saveSettings();
					this.display(); // refresh model dropdown
				});
			});

		// --- Model picker ---
		const currentProvider = this.providers.find(
			(p) => p.id === currentProviderId
		);
		new Setting(containerEl)
			.setName("Model")
			.setDesc("provider 提供的具体模型。")
			.addDropdown((dd) => {
				if (!currentProvider) {
					dd.addOption("", "— 先选 provider —");
					dd.setDisabled(true);
					return;
				}
				dd.addOption("", "— 请选择 —");
				for (const m of currentProvider.models) {
					dd.addOption(m.model, m.modelName ? `${m.modelName} (${m.model})` : m.model);
				}
				dd.setValue(this.plugin.settings.model || "");
				dd.onChange(async (v) => {
					this.plugin.settings.model = v;
					await this.plugin.saveSettings();
				});
			});

		// --- Workspace path (for identity files) ---
		new Setting(containerEl)
			.setName("身份文件目录 (workspacePath)")
			.setDesc(
				"小皮读这个目录下的 CLAUDE.md + .claude/rules/01-04 来加载身份。留空则用 vault 的父目录 (推荐:brain 在 mino/ 下时父目录就是 mino)。"
			)
			.addText((text) =>
				text
					.setPlaceholder("C:\\Users\\PC\\.myagents\\projects\\mino")
					.setValue(this.plugin.settings.workspacePath)
					.onChange(async (v) => {
						this.plugin.settings.workspacePath = v;
						await this.plugin.saveSettings();
					})
			);

		// --- Advanced ---
		containerEl.createEl("h3", { text: "高级" });

		new Setting(containerEl)
			.setName("最大工具循环轮数")
			.setDesc("一条用户消息最多触发多少次模型→工具→模型的轮次。")
			.addText((text) =>
				text
					.setPlaceholder("15")
					.setValue(String(this.plugin.settings.maxTurns))
					.onChange(async (v) => {
						const n = parseInt(v, 10);
						if (!isNaN(n) && n >= 1 && n <= 50) {
							this.plugin.settings.maxTurns = n;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("最大响应 token 数")
			.setDesc("每次 LLM 调用允许的最大 token。")
			.addText((text) =>
				text
					.setPlaceholder("4096")
					.setValue(String(this.plugin.settings.maxTokens))
					.onChange(async (v) => {
						const n = parseInt(v, 10);
						if (!isNaN(n) && n >= 256 && n <= 32000) {
							this.plugin.settings.maxTokens = n;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("重新加载 Provider 列表")
			.setDesc("如果你刚在 MyAgents 里配了新 provider,点这里刷新。")
			.addButton((btn) =>
				btn.setButtonText("刷新").onClick(() => {
					new Notice("已重新加载 provider 列表。");
					this.display();
				})
			);
	}
}
