const { buildAssistantContext } = require("./context");
const { detectMode } = require("./modes");
const { buildPrompt } = require("./prompts");
const { executeTool } = require("./tools");
const { addMemory, appendMessage } = require("../data/store");

const MAX_MESSAGE_LENGTH = 24_000;
const MAX_ATTACHMENTS = 4;

class AIOrchestrator {
	constructor({ primaryProvider, fallbackProvider, getProjectStructure } = {}) {
		const { DemoProvider } = require("./providers");
		this.primaryProvider = primaryProvider;
		this.fallbackProvider = fallbackProvider || new DemoProvider();
		this.getProjectStructure = getProjectStructure || (async () => ({}));
	}

	async generate(request) {
		const prepared = await this.prepare(request);
		const startedAt = Date.now();
		const toolHistory = [];

		let result;
		if (this.primaryProvider?.isConfigured?.()) {
			try {
				result = await this.primaryProvider.runAgentLoop({
					prompt: prepared.prompt,
					sessionId: prepared.sessionId,
					maxIterations: 4,
					executeTool: (name, args, ctx) =>
						executeTool(name, args, { ...ctx, projectRoot: prepared.projectRoot }),
					metadata: prepared.metadata,
				});
			} catch (error) {
				console.error("Primary agent loop failed; falling back to DemoProvider:", error.message);
			}
		}

		if (!result) {
			result = await this.fallbackProvider.runAgentLoop({
				prompt: prepared.prompt,
				sessionId: prepared.sessionId,
				executeTool: (name, args, ctx) =>
					executeTool(name, args, { ...ctx, projectRoot: prepared.projectRoot }),
				metadata: prepared.metadata,
			});
		}

		this.recordExchange(prepared, result.text, result.tools);

		return {
			success: true,
			message: result.text,
			tools: result.tools || [],
			mode: prepared.mode,
			model: result.model,
			latencyMs: Date.now() - startedAt,
		};
	}

	async *stream(request) {
		const prepared = await this.prepare(request);
		const startedAt = Date.now();
		let fullText = "";
		let model = "demo";
		let streamed = false;
		const executedTools = [];

		if (this.primaryProvider?.isConfigured?.()) {
			try {
				for await (const event of this.primaryProvider.streamAgentLoop({
					prompt: prepared.prompt,
					sessionId: prepared.sessionId,
					maxIterations: 4,
					executeTool: (name, args, ctx) =>
						executeTool(name, args, { ...ctx, projectRoot: prepared.projectRoot }),
				})) {
					streamed = true;
					if (event.type === "tool") {
						executedTools.push(event);
						yield event;
					} else if (event.type === "chunk") {
						model = event.model;
						fullText += event.text;
						yield event;
					}
				}
			} catch (error) {
				console.error("Primary streamAgentLoop failed; falling back to DemoProvider:", error.message);
			}
		}

		if (!streamed) {
			for await (const event of this.fallbackProvider.streamAgentLoop({
				prompt: prepared.prompt,
				sessionId: prepared.sessionId,
				executeTool: (name, args, ctx) =>
					executeTool(name, args, { ...ctx, projectRoot: prepared.projectRoot }),
				metadata: prepared.metadata,
			})) {
				if (event.type === "tool") {
					executedTools.push(event);
					yield event;
				} else if (event.type === "chunk") {
					model = event.model;
					fullText += event.text;
					yield event;
				}
			}
		}

		this.recordExchange(prepared, fullText, executedTools);

		yield {
			type: "done",
			mode: prepared.mode,
			model,
			tools: executedTools,
			latencyMs: Date.now() - startedAt,
		};
	}

	async prepare(request) {
		const message = validateMessage(request.message);
		const attachments = validateAttachments(request.attachments);
		const mode = detectMode(message, request.mode);
		const projectStructure = request.includeProject
			? await this.getProjectStructure()
			: null;
		const context = buildAssistantContext({
			sessionId: request.sessionId,
			mode,
			projectStructure,
			attachments,
			dailyAssistantContext: validateDailyAssistantContext(
				request.assistantContext,
			),
		});

		return {
			sessionId: request.sessionId,
			message,
			mode,
			projectRoot: process.cwd(),
			prompt: buildPrompt({ message, context }),
			metadata: { mode, message, sessionId: request.sessionId },
		};
	}

	recordExchange(prepared, assistantText, tools = []) {
		appendMessage(prepared.sessionId, {
			role: "user",
			content: prepared.message,
			mode: prepared.mode,
		});
		appendMessage(prepared.sessionId, {
			role: "assistant",
			content: assistantText,
			mode: prepared.mode,
			tools,
		});
		recordProductivityMemory(prepared.sessionId, prepared.message, prepared.mode, tools);
	}
}

function validateMessage(message) {
	const value = String(message || "").trim();
	if (!value) {
		const error = new Error("Please send a non-empty message.");
		error.statusCode = 400;
		throw error;
	}

	if (value.length > MAX_MESSAGE_LENGTH) {
		const error = new Error("Message is too long for a single request.");
		error.statusCode = 413;
		throw error;
	}

	return value;
}

function validateAttachments(attachments) {
	if (!attachments) return [];
	if (!Array.isArray(attachments)) {
		const error = new Error("Attachments must be an array.");
		error.statusCode = 400;
		throw error;
	}

	return attachments.slice(0, MAX_ATTACHMENTS).map((attachment) => ({
		name: String(attachment.name || "attachment").slice(0, 120),
		language: String(attachment.language || "text").slice(0, 40),
		content: String(attachment.content || "").slice(0, 12_000),
	}));
}

function validateDailyAssistantContext(context) {
	if (!context || typeof context !== "object" || Array.isArray(context)) {
		return null;
	}

	return {
		weather: String(context.weather || "").slice(0, 500),
		calendarEvents: sanitizeList(context.calendarEvents, 8),
		importantEmails: sanitizeList(context.importantEmails, 8),
		tasks: sanitizeList(context.tasks, 12),
		reminders: sanitizeList(context.reminders, 8),
	};
}

function sanitizeList(items, limit) {
	if (!Array.isArray(items)) return [];

	return items.slice(0, limit).map((item) => {
		if (!item || typeof item !== "object") {
			return String(item || "").slice(0, 300);
		}

		return Object.fromEntries(
			Object.entries(item)
				.slice(0, 12)
				.map(([key, value]) => [
					String(key).slice(0, 80),
					typeof value === "boolean" ? value : String(value ?? "").slice(0, 500),
				]),
		);
	});
}

function recordProductivityMemory(sessionId, message, mode, tools = []) {
	const lower = message.toLowerCase();
	const priorityKeywords = [
		"focus",
		"priority",
		"deadline",
		"urgent",
		"schedule",
		"routine",
		"habit",
		"goal",
	].filter((keyword) => lower.includes(keyword));

	if (priorityKeywords.length > 0 || tools.length > 0 || mode === "planner" || mode === "tasks") {
		addMemory(sessionId, {
			type: "productivity-preference",
			summary: tools.length > 0
				? `Executed ${tools.map((t) => t.tool || t.name).join(", ")} based on user prompt.`
				: `User engaged on ${priorityKeywords.join(", ") || mode} planning.`,
			keywords: priorityKeywords,
		});
	}
}

module.exports = {
	AIOrchestrator,
	validateMessage,
};
