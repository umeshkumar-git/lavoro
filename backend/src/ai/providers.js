const { TOOL_DECLARATIONS, formatToolMessage } = require("./tools");

class GeminiProvider {
	constructor({ apiKey, modelNames, GoogleGenerativeAI }) {
		this.modelNames = modelNames;
		this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
	}

	isConfigured() {
		return Boolean(this.client);
	}

	async runAgentLoop({ prompt, sessionId, maxIterations = 4, executeTool, onToolCall }) {
		if (!this.client) return null;

		let lastError = null;
		for (const modelName of this.modelNames) {
			try {
				const model = this.client.getGenerativeModel({
					model: modelName,
					tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
				});

				const chat = model.startChat();
				let response = await chat.sendMessage(prompt);
				let iteration = 0;
				const toolHistory = [];

				while (iteration < maxIterations) {
					const calls = response.response.functionCalls();
					if (!calls || calls.length === 0) {
						break;
					}

					const functionResponses = [];
					for (const call of calls) {
						const toolResult = await executeTool(call.name, call.args, { sessionId });
						const toolEvent = {
							tool: call.name,
							args: call.args,
							result: toolResult,
							message: formatToolMessage(call.name, toolResult),
						};

						toolHistory.push(toolEvent);
						if (onToolCall) {
							onToolCall(toolEvent);
						}

						functionResponses.push({
							functionResponse: {
								name: call.name,
								response: toolResult,
							},
						});
					}

					iteration++;
					response = await chat.sendMessage(functionResponses);
				}

				return {
					text: response.response.text(),
					model: modelName,
					tools: toolHistory,
				};
			} catch (error) {
				lastError = error;
				console.error(`Gemini agent loop failed on ${modelName}:`, error.message);
			}
		}

		throw lastError || new Error("No Gemini model was available for agent execution.");
	}

	async *streamAgentLoop({ prompt, sessionId, maxIterations = 4, executeTool }) {
		if (!this.client) return;

		// Execute the agent tool loop first to gather all tool observations
		const toolEvents = [];
		const result = await this.runAgentLoop({
			prompt,
			sessionId,
			maxIterations,
			executeTool,
			onToolCall: (event) => toolEvents.push(event),
		});

		// Yield tool execution events first
		for (const event of toolEvents) {
			yield {
				type: "tool",
				tool: event.tool,
				message: event.message,
				result: event.result,
			};
		}

		// Stream the final synthesized text response
		const chunks = result.text.match(/.{1,60}(\s|$)/g) || [result.text];
		for (const chunk of chunks) {
			yield { type: "chunk", text: chunk, model: result.model };
		}
	}
}

class DemoProvider {
	async runAgentLoop({ prompt, sessionId, executeTool, onToolCall, metadata = {} }) {
		const message = String(metadata.message || prompt || "").trim();
		const toolCall = detectToolIntent(message);
		const toolHistory = [];

		if (toolCall && executeTool) {
			const toolResult = await executeTool(toolCall.name, toolCall.args, { sessionId });
			const toolEvent = {
				tool: toolCall.name,
				args: toolCall.args,
				result: toolResult,
				message: formatToolMessage(toolCall.name, toolResult),
			};
			toolHistory.push(toolEvent);
			if (onToolCall) {
				onToolCall(toolEvent);
			}
		}

		const responseText = createSynthesizedDemoResponse(metadata, toolHistory);

		return {
			text: responseText,
			model: "demo",
			tools: toolHistory,
		};
	}

	async *streamAgentLoop({ prompt, sessionId, executeTool, metadata = {} }) {
		const toolEvents = [];
		const result = await this.runAgentLoop({
			prompt,
			sessionId,
			executeTool,
			onToolCall: (event) => toolEvents.push(event),
			metadata,
		});

		for (const event of toolEvents) {
			yield {
				type: "tool",
				tool: event.tool,
				message: event.message,
				result: event.result,
			};
		}

		const chunks = result.text.match(/.{1,60}(\s|$)/g) || [result.text];
		for (const chunk of chunks) {
			yield { type: "chunk", text: chunk, model: "demo" };
		}
	}
}

function detectToolIntent(message) {
	const text = String(message || "").trim();
	const lower = text.toLowerCase();

	// 1. Task Creation
	if (
		/\b(add task|create task|new task|add to-do|add todo|put ['"].*?['"] on my task list)\b/i.test(
			lower,
		) ||
		(lower.startsWith("add a task") || lower.startsWith("create a task") || lower.startsWith("put "))
	) {
		let title = text
			.replace(/^.*?\b(add a task to|add task to|create a task to|create task to|add a task:|add task:|add to-do:|add todo:|new task:|put )/i, "")
			.replace(/\b(on my task list|on my to-do list|with high priority|with medium priority|with low priority)\b/gi, "")
			.replace(/\b(tomorrow|today|this week)\b/gi, "")
			.replace(/^[\s:'"]+|[\s:'"]+$/g, "")
			.trim();

		if (!title) title = "New task item";

		let priority = "medium";
		if (/\b(high priority|urgent|important|asap)\b/i.test(lower)) priority = "high";
		else if (/\b(low priority|minor)\b/i.test(lower)) priority = "low";

		let due = "today";
		if (/\btomorrow\b/i.test(lower)) due = "tomorrow";
		else if (/\b(this week|next week)\b/i.test(lower)) due = "this week";

		return {
			name: "createTask",
			args: { title, priority, due },
		};
	}

	// 2. Reminder Creation
	if (
		/\b(remind me|set a reminder|add reminder|don't let me forget|dont let me forget)\b/i.test(
			lower,
		)
	) {
		let title = text
			.replace(/^.*?\b(remind me to|remind me about|set a reminder for|set a reminder to|add reminder for|add reminder to|don't let me forget to|dont let me forget to)\b/i, "")
			.replace(/^(tomorrow|today|at|on)\s+/i, "")
			.replace(/[.!?]+$/, "")
			.trim();

		if (!title) title = "Scheduled reminder";

		let when = "today 18:00";
		const timeMatch = text.match(/\b(at \d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
		if (timeMatch) {
			when = (lower.includes("tomorrow") ? "tomorrow " : "today ") + timeMatch[1];
		} else if (lower.includes("tomorrow")) {
			when = "tomorrow 09:00";
		}

		return {
			name: "addReminder",
			args: { title, when },
		};
	}

	// 3. Daily Plan Creation
	if (
		/\b(plan my day|plan my schedule|create a daily plan|build a schedule|schedule my day|schedule my afternoon)\b/i.test(
			lower,
		)
	) {
		return {
			name: "createDailyPlan",
			args: { prompt: text },
		};
	}

	// 4. Project Search
	if (
		/\b(search the codebase|search codebase|search project|find references|search in our repository|search the repo)\b/i.test(
			lower,
		)
	) {
		const query = text
			.replace(/^.*?\b(search the codebase for|search codebase for|search project for|find references to|search in our repository for|search the repo for)\b/i, "")
			.replace(/^[\s:'"]+|[\s:'"]+$/g, "")
			.trim() || text;

		return {
			name: "searchProject",
			args: { query },
		};
	}

	// 5. Document Query (RAG)
	if (
		/\b(query documents|search our knowledge base|search knowledge base|find any documents|search documents|search notes)\b/i.test(
			lower,
		)
	) {
		const query = text
			.replace(/^.*?\b(query documents for|search our knowledge base for|find any documents about|search documents for|search notes for)\b/i, "")
			.replace(/^[\s:'"]+|[\s:'"]+$/g, "")
			.trim() || text;

		return {
			name: "queryDocuments",
			args: { query },
		};
	}

	return null;
}

function createSynthesizedDemoResponse(metadata = {}, tools = []) {
	const mode = metadata.mode || "assistant";
	const tool = tools[0];

	if (tool) {
		if (tool.tool === "createTask") {
			return `I have added the task **"${tool.args.title}"** to your workspace with **${tool.args.priority || "medium"} priority** (due: ${tool.args.due || "today"}). It is now tracked in your priority board.`;
		}
		if (tool.tool === "addReminder") {
			return `I've scheduled a reminder for you: **"${tool.args.title}"** set for **${tool.args.when || "today 18:00"}**. I will notify you when it is time.`;
		}
		if (tool.tool === "createDailyPlan") {
			return `I have constructed your time-blocked plan for today:\n\n${tool.result?.result?.summary || "Focus blocks structured around your active tasks."}\n\nYour schedule is now synchronized with your active commitments.`;
		}
		if (tool.tool === "searchProject") {
			return `I searched the project workspace for **"${tool.args.query}"** and found ${tool.result?.result?.length || 0} relevant locations.`;
		}
		if (tool.tool === "queryDocuments") {
			return `I searched your knowledge base for **"${tool.args.query}"** and retrieved ${tool.result?.result?.length || 0} relevant document sections.`;
		}
	}

	// Standard conversational responses by mode
	const responses = {
		assistant: `Hello! I am Lavoro, your AI personal daily assistant.\n\nI can help you:\n• Prepare your **Morning Briefing** with calendar and weather context\n• Prioritize your **Tasks** using the Eisenhower matrix\n• Triage unread **Emails** and draft quick replies\n• Structure a realistic **Time-Blocked Day Plan**\n\nHow can I help you organize your workday right now?`,
		briefing: `Good morning! Here is your executive briefing for today:\n\n🌤️ **Weather**: 22°C, Partly Cloudy — clear skies expected throughout the afternoon.\n\n📅 **Key Schedule**:\n• **09:00 AM** — Team Standup (30 min)\n• **11:00 AM** — Project Review (1 hour)\n• **02:00 PM** — Client Call (Important, 45 min)\n• **04:00 PM** — Code Review (30 min)\n\n📬 **Priority Emails**:\n• **manager@company.com** — *Q4 Goals Discussion* (Action: review proposed targets before sync)\n\n⭐ **Top Priority Task**:\n• Review daily schedule and prioritize urgent emails\n\nHave a productive and focused day!`,
		planner: `Here is your suggested time-blocked daily schedule:\n\n• **08:30 - 09:00**: Morning inbox triage & daily review\n• **09:00 - 09:30**: Team Standup\n• **09:30 - 11:00**: 🎯 **Deep Work Block 1** (Focus: Core deliverables & client prep)\n• **11:00 - 12:00**: Project Review Meeting\n• **12:00 - 01:00**: Lunch & administrative check-in\n• **02:00 - 02:45**: Client Call (High Priority)\n• **03:00 - 04:00**: 🎯 **Deep Work Block 2** (Focus: Execution & follow-ups)\n• **04:00 - 04:30**: Code Review\n• **05:30 - 06:00**: End-of-day retrospective & tomorrow's setup\n\nWould you like to adjust any of these focus intervals?`,
		tasks: `Here is your prioritized task breakdown (Eisenhower Matrix):\n\n🔥 **Urgent & Important (Do Immediately)**:\n1. Review daily schedule and prioritize urgent emails (Due: Today)\n2. Prepare briefing notes for client review call (Due: Today)\n\n📌 **Important, Not Urgent (Schedule)**:\n3. Review team productivity metrics and project deliverables (Due: Tomorrow)\n\n💡 **Recommendation**: Tackle the client briefing notes during your morning deep work block before the 11:00 AM meeting.`,
		email: `📬 **Email Triage Summary**:\n\n1. **High Priority**: *manager@company.com* — **Q4 Goals Discussion** (Today, 8:15 AM)\n   • *Preview*: "Please review the proposed goals before our afternoon sync."\n   • *Action*: Review attached goals doc before 02:00 PM.\n\n2. **Medium Priority**: *design@company.com* — **Dashboard refresh notes** (Yesterday)\n   • *Preview*: "A few interface polish ideas are ready for review."\n   • *Action*: Queued for afternoon review block.\n\nWould you like me to draft a quick reply to your manager?`,
		summary: `📊 **Daily Executive Summary**:\n\n• **Productivity Score**: 88/100\n• **Completed Key Focus**: Delivered primary project milestones, prepped client review, and resolved critical communications.\n• **Carried Over**: Team productivity metric review scheduled for tomorrow morning.\n• **Focus Recommendation**: Protect tomorrow's 09:30 AM deep work block.\n\nGreat execution today!`,
	};

	return responses[mode] || responses.assistant;
}

module.exports = {
	DemoProvider,
	GeminiProvider,
	detectToolIntent,
};
