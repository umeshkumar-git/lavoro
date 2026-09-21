class GeminiProvider {
	constructor({ apiKey, modelNames, GoogleGenerativeAI }) {
		this.modelNames = modelNames;
		this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
	}

	isConfigured() {
		return Boolean(this.client);
	}

	async generate(prompt) {
		if (!this.client) return null;

		let lastError = null;
		for (const modelName of this.modelNames) {
			try {
				const model = this.client.getGenerativeModel({ model: modelName });
				const result = await model.generateContent(prompt);
				const response = await result.response;
				return {
					text: response.text(),
					model: modelName,
				};
			} catch (error) {
				lastError = error;
				console.error(`Gemini request failed for ${modelName}:`, error.message);
			}
		}

		throw lastError || new Error("No Gemini model was available.");
	}

	async *stream(prompt) {
		if (!this.client) return;

		let lastError = null;
		for (const modelName of this.modelNames) {
			try {
				const model = this.client.getGenerativeModel({ model: modelName });
				const result = await model.generateContentStream(prompt);

				for await (const chunk of result.stream) {
					const text = chunk.text();
					if (text) yield { text, model: modelName };
				}

				return;
			} catch (error) {
				lastError = error;
				console.error(`Gemini stream failed for ${modelName}:`, error.message);
			}
		}

		throw lastError || new Error("No Gemini streaming model was available.");
	}
}

class DemoProvider {
	async generate(_, metadata) {
		return {
			text: createDemoResponse(metadata),
			model: "demo",
		};
	}

	async *stream(_, metadata) {
		const text = createDemoResponse(metadata);
		const chunks = text.match(/.{1,80}(\s|$)/g) || [text];

		for (const chunk of chunks) {
			yield { text: chunk, model: "demo" };
		}
	}
}

function createDemoResponse(metadata = {}) {
	const mode = metadata.mode || "assistant";
	const message = String(metadata.message || "").trim();

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
};
