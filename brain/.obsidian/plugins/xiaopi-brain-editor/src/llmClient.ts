import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { requestUrl } from "obsidian";
import { TOOL_DEFINITIONS, type ToolDefinition } from "./tools";

/**
 * Anthropic Messages API client + tool-use loop.
 *
 * Speaks the Anthropic /v1/messages protocol against any compatible endpoint
 * (DeepSeek/MiniMax/Kimi Coding all expose /anthropic suffixes). Streams SSE,
 * dispatches tool calls, feeds tool_result back, loops until end_turn or stop.
 */

// ---------------------------------------------------------------------------
// Provider config — loaded from ~/.myagents/config.json
// ---------------------------------------------------------------------------

export interface ProviderInfo {
	id: string;
	name: string;
	baseUrl?: string;
	authType?: "auth_token" | "api_key" | "both" | "auth_token_clear_api_key" | string;
	apiKey?: string;
	primaryModel?: string;
	models: { model: string; modelName?: string }[];
}

export async function loadProviders(): Promise<ProviderInfo[]> {
	const configPath = path.join(os.homedir(), ".myagents", "config.json");
	const text = await fs.readFile(configPath, "utf-8");
	const cfg = JSON.parse(text);
	const list = JSON.parse(cfg.availableProvidersJson || "[]") as any[];
	const verify = cfg.providerVerifyStatus || {};
	const keys = cfg.providerApiKeys || {};

	const out: ProviderInfo[] = [];
	for (const p of list) {
		if (!p || typeof p !== "object") continue;
		// Skip Anthropic subscription — that's claude-cli login, not API.
		if (p.id === "anthropic-sub") continue;
		// Skip providers that don't have an Anthropic-compatible baseUrl.
		// Heuristic: must have baseUrl + an apiKey.
		const apiKey: string | undefined = p.apiKey || keys[p.id];
		if (!p.baseUrl || !apiKey) continue;
		// Skip invalid providers.
		if (verify[p.id]?.status === "invalid") continue;
		out.push({
			id: p.id,
			name: p.name || p.id,
			baseUrl: p.baseUrl,
			authType: p.authType,
			apiKey,
			primaryModel: p.primaryModel,
			models: Array.isArray(p.models) ? p.models : [],
		});
	}
	return out;
}

// ---------------------------------------------------------------------------
// Anthropic message types
// ---------------------------------------------------------------------------

export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "tool_use"; id: string; name: string; input: Record<string, any> }
	| {
			type: "tool_result";
			tool_use_id: string;
			content: string;
			is_error?: boolean;
	  };

export interface ChatMessage {
	role: "user" | "assistant";
	content: ContentBlock[];
}

// ---------------------------------------------------------------------------
// Streaming chat: yields events as they arrive
// ---------------------------------------------------------------------------

export type StreamEvent =
	| { type: "text_delta"; text: string }
	| { type: "tool_use_start"; id: string; name: string }
	| { type: "tool_use_complete"; id: string; name: string; input: Record<string, any> }
	| { type: "message_complete"; stop_reason: string; content: ContentBlock[] }
	| { type: "error"; message: string };

export interface StreamRequest {
	provider: ProviderInfo;
	model: string;
	system: string;
	messages: ChatMessage[];
	tools: ToolDefinition[];
	maxTokens?: number;
	signal?: AbortSignal;
}

/** Build Authorization-style headers per Anthropic auth conventions. */
function buildHeaders(provider: ProviderInfo): Record<string, string> {
	const h: Record<string, string> = {
		"content-type": "application/json",
		"anthropic-version": "2023-06-01",
		accept: "text/event-stream",
	};
	const key = provider.apiKey ?? "";
	const authType = provider.authType || "auth_token";
	if (authType === "api_key") {
		h["x-api-key"] = key;
	} else if (authType === "both") {
		h["x-api-key"] = key;
		h["authorization"] = `Bearer ${key}`;
	} else if (authType === "auth_token_clear_api_key") {
		h["authorization"] = `Bearer ${key}`;
	} else {
		// auth_token (default)
		h["authorization"] = `Bearer ${key}`;
	}
	return h;
}

function endpointUrl(provider: ProviderInfo): string {
	const base = (provider.baseUrl || "").replace(/\/+$/, "");
	// Most Anthropic-compatible providers serve at <base>/v1/messages.
	if (base.endsWith("/v1/messages")) return base;
	if (base.endsWith("/v1")) return `${base}/messages`;
	return `${base}/v1/messages`;
}

/**
 * Run a chat completion via Obsidian's requestUrl (Node main-process HTTP,
 * bypasses CORS). Non-streaming: we wait for the full response, then synthesize
 * StreamEvents so callers can stay protocol-agnostic. Streaming UX is sacrificed
 * for reliability — Obsidian's renderer fetch is unreliable for LLM endpoints
 * without CORS headers.
 */
export async function* streamChat(
	req: StreamRequest
): AsyncGenerator<StreamEvent, void, void> {
	const url = endpointUrl(req.provider);
	const headers = buildHeaders(req.provider);
	const requestBody = {
		model: req.model,
		max_tokens: req.maxTokens ?? 4096,
		// requestUrl can't read streaming SSE bodies; use buffered response.
		stream: false,
		system: req.system,
		messages: req.messages.map((m) => ({
			role: m.role,
			content: m.content,
		})),
		tools: req.tools.map((t) => ({
			name: t.name,
			description: t.description,
			input_schema: t.input_schema,
		})),
	};
	const bodyStr = JSON.stringify(requestBody);

	console.log("[xiaopi] POST", url, "model=", req.model, "msg-count=", req.messages.length);

	let resp: { status: number; text: string; json: any };
	try {
		const r = await requestUrl({
			url,
			method: "POST",
			headers,
			body: bodyStr,
			throw: false, // don't auto-throw on 4xx/5xx — we want to see the body
		});
		resp = { status: r.status, text: r.text, json: r.json };
	} catch (e: any) {
		console.error("[xiaopi] requestUrl threw", e);
		yield { type: "error", message: `网络错误: ${e?.message ?? e}` };
		return;
	}

	console.log("[xiaopi] HTTP", resp.status);

	if (resp.status < 200 || resp.status >= 300) {
		const snippet = (resp.text ?? "").slice(0, 600);
		yield {
			type: "error",
			message: `HTTP ${resp.status}: ${snippet || "(空响应体)"}`,
		};
		return;
	}

	let payload: any;
	try {
		payload = resp.json ?? JSON.parse(resp.text);
	} catch (e: any) {
		yield {
			type: "error",
			message: `响应不是合法 JSON (前 400 字符): ${(resp.text ?? "").slice(0, 400)}`,
		};
		return;
	}

	if (payload?.type === "error" || payload?.error) {
		const msg =
			payload.error?.message ??
			payload.message ??
			JSON.stringify(payload).slice(0, 400);
		yield { type: "error", message: `API 错误: ${msg}` };
		return;
	}

	// Anthropic non-streaming response shape:
	// { id, type:"message", role:"assistant", content: [...blocks], stop_reason, ... }
	const content: any[] = Array.isArray(payload?.content) ? payload.content : [];
	const stopReason: string = payload?.stop_reason ?? "end_turn";
	const finalBlocks: ContentBlock[] = [];

	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "text") {
			const text: string = block.text ?? "";
			finalBlocks.push({ type: "text", text });
			// Synthesize a single text_delta so the UI can render incrementally
			// even though we got the whole thing at once.
			if (text) yield { type: "text_delta", text };
		} else if (block.type === "tool_use") {
			const id = block.id ?? `tool_${Math.random().toString(36).slice(2)}`;
			const name = block.name ?? "";
			const input = block.input ?? {};
			yield { type: "tool_use_start", id, name };
			finalBlocks.push({ type: "tool_use", id, name, input });
			yield { type: "tool_use_complete", id, name, input };
		}
	}

	yield { type: "message_complete", stop_reason: stopReason, content: finalBlocks };
}

// ---------------------------------------------------------------------------
// Tool-use loop driver
// ---------------------------------------------------------------------------

export interface AgentLoopHandlers {
	onTextDelta?: (text: string) => void;
	onToolUseStart?: (name: string, id: string) => void;
	onToolUseComplete?: (
		name: string,
		id: string,
		input: Record<string, any>
	) => void;
	onToolResult?: (
		name: string,
		id: string,
		result: { content: string; is_error?: boolean }
	) => void;
	onAssistantTurnComplete?: (content: ContentBlock[], stopReason: string) => void;
	onError?: (message: string) => void;
}

export interface AgentLoopRequest {
	provider: ProviderInfo;
	model: string;
	system: string;
	/** Conversation history excluding the new user message (caller pushes it first). */
	messages: ChatMessage[];
	executeTool: (
		name: string,
		input: Record<string, any>
	) => Promise<{ content: string; is_error?: boolean }>;
	handlers: AgentLoopHandlers;
	maxTurns?: number;
	maxTokens?: number;
	signal?: AbortSignal;
}

/**
 * Run the agent loop until the model stops (no tool use) or we hit maxTurns.
 * Mutates `messages` in place so the caller can persist the full history.
 */
export async function runAgentLoop(req: AgentLoopRequest): Promise<void> {
	const maxTurns = req.maxTurns ?? 12;
	for (let turn = 0; turn < maxTurns; turn++) {
		const collected: ContentBlock[] = [];
		let stopReason = "end_turn";
		let sawError = false;

		const stream = streamChat({
			provider: req.provider,
			model: req.model,
			system: req.system,
			messages: req.messages,
			tools: TOOL_DEFINITIONS,
			maxTokens: req.maxTokens,
			signal: req.signal,
		});

		for await (const evt of stream) {
			if (req.signal?.aborted) return;
			switch (evt.type) {
				case "text_delta":
					req.handlers.onTextDelta?.(evt.text);
					break;
				case "tool_use_start":
					req.handlers.onToolUseStart?.(evt.name, evt.id);
					break;
				case "tool_use_complete":
					req.handlers.onToolUseComplete?.(evt.name, evt.id, evt.input);
					break;
				case "message_complete":
					collected.push(...evt.content);
					stopReason = evt.stop_reason;
					break;
				case "error":
					req.handlers.onError?.(evt.message);
					sawError = true;
					break;
			}
		}

		if (sawError) return;

		// Push assistant's turn into history.
		if (collected.length > 0) {
			req.messages.push({ role: "assistant", content: collected });
		}
		req.handlers.onAssistantTurnComplete?.(collected, stopReason);

		// Did the model request tools?
		const toolUses = collected.filter(
			(b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
		);
		if (toolUses.length === 0 || stopReason !== "tool_use") {
			return; // turn complete, wait for user
		}

		// Execute tools, collect tool_result blocks.
		const toolResults: ContentBlock[] = [];
		for (const tu of toolUses) {
			let result: { content: string; is_error?: boolean };
			try {
				result = await req.executeTool(tu.name, tu.input);
			} catch (e: any) {
				result = {
					content: `Tool execution threw: ${e?.message ?? e}`,
					is_error: true,
				};
			}
			req.handlers.onToolResult?.(tu.name, tu.id, result);
			toolResults.push({
				type: "tool_result",
				tool_use_id: tu.id,
				content: result.content,
				is_error: result.is_error,
			});
		}
		req.messages.push({ role: "user", content: toolResults });
		// Loop again so the model can react to results.
	}

	req.handlers.onError?.(`Hit max turns (${maxTurns}). Stopping to avoid runaway.`);
}
