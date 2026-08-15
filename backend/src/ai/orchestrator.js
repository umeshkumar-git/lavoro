const { buildAssistantContext } = require("./context");
const { detectMode, normalizeLevel, normalizeTeachingStyle } = require("./modes");
const { buildPrompt } = require("./prompts");
const { addMemory, appendMessage, getProfile } = require("../data/store");

const MAX_MESSAGE_LENGTH = 24_000;
const MAX_ATTACHMENTS = 4;

class AIOrchestrator {
	constructor({ primaryProvider, fallbackProvider, getProjectStructure }) {
		this.primaryProvider = primaryProvider;
		this.fallbackProvider = fallbackProvider;
		this.getProjectStructure = getProjectStructure;
	}

	async generate(request) {
		const prepared = await this.prepare(request);
		const startedAt = Date.now();

		let result;
		try {
			result = this.primaryProvider?.isConfigured?.()
				? await this.primaryProvider.generate(prepared.prompt, prepared.metadata)
				: null;
		} catch (error) {
			console.error("Primary LLM failed; falling back:", error.message);
		}

		if (!result) {
			result = await this.fallbackProvider.generate(
				prepared.prompt,
				prepared.metadata,
			);
		}

		this.recordExchange(prepared, result.text);

		return {
			success: true,
			message: result.text,
			mode: prepared.mode,
			level: prepared.level,
			teachingStyle: prepared.teachingStyle,
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

		if (this.primaryProvider?.isConfigured?.()) {
			try {
				for await (const chunk of this.primaryProvider.stream(
					prepared.prompt,
					prepared.metadata,
				)) {
					streamed = true;
					model = chunk.model;
					fullText += chunk.text;
					yield { type: "chunk", text: chunk.text, model };
				}
			} catch (error) {
				console.error("Primary stream failed; falling back:", error.message);
			}
		}

		if (!streamed) {
			for await (const chunk of this.fallbackProvider.stream(
				prepared.prompt,
				prepared.metadata,
			)) {
				model = chunk.model;
				fullText += chunk.text;
				yield { type: "chunk", text: chunk.text, model };
			}
		}

		this.recordExchange(prepared, fullText);
		yield {
			type: "done",
			mode: prepared.mode,
			level: prepared.level,
			teachingStyle: prepared.teachingStyle,
			model,
			latencyMs: Date.now() - startedAt,
		};
	}

	async prepare(request) {
		const message = validateMessage(request.message);
		const attachments = validateAttachments(request.attachments);
		const mode = detectMode(message, request.mode);
		const level = normalizeLevel(request.level || getProfile(request.sessionId).experienceLevel);
		const teachingStyle = normalizeTeachingStyle(
			request.teachingStyle || getProfile(request.sessionId).preferredStyle,
		);
		const projectStructure = request.includeProject
			? await this.getProjectStructure()
			: null;
		const context = buildAssistantContext({
			sessionId: request.sessionId,
			mode,
			level,
			teachingStyle,
			projectStructure,
			attachments,
		});

		return {
			sessionId: request.sessionId,
			message,
			mode,
			level,
			teachingStyle,
			prompt: buildPrompt({ message, context }),
			metadata: { mode, level, teachingStyle, message },
		};
	}

	recordExchange(prepared, assistantText) {
		appendMessage(prepared.sessionId, {
			role: "user",
			content: prepared.message,
			mode: prepared.mode,
		});
		appendMessage(prepared.sessionId, {
			role: "assistant",
			content: assistantText,
			mode: prepared.mode,
		});
		recordLearningMemory(prepared.sessionId, prepared.message, prepared.mode);
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

function recordLearningMemory(sessionId, message, mode) {
	const lower = message.toLowerCase();
	const weakTopicMatches = [
		"async",
		"promise",
		"react",
		"recursion",
		"database",
		"sql",
		"api",
		"system design",
	].filter((topic) => lower.includes(topic));

	if (weakTopicMatches.length > 0 || mode === "debug" || mode === "review") {
		addMemory(sessionId, {
			type: mode === "debug" ? "debugging" : "learning",
			summary: `Student asked about ${weakTopicMatches.join(", ") || mode}.`,
			topics: weakTopicMatches,
		});
	}
}

module.exports = {
	AIOrchestrator,
	validateMessage,
};
