const { getTasks, getConversation, getProfile, getPlans } = require("../data/store");

async function generateExecutiveSummary({
	tasks = [],
	notes = [],
	goals = [],
	sessionId = "default-session",
} = {}) {
	const resolvedTasks = Array.isArray(tasks) && tasks.length
		? tasks
		: getTasks(sessionId).map((task) => ({ ...task }));
	const resolvedNotes = Array.isArray(notes) && notes.length
		? notes
		: getConversation(sessionId).map((message) => message.content || "");
	const resolvedGoals = Array.isArray(goals) && goals.length
		? goals
		: (getProfile(sessionId).goal ? [getProfile(sessionId).goal] : []).concat(
				getPlans(sessionId).map((plan) => plan.summary || ""),
			);

	const completedTasks = resolvedTasks.filter((task) =>
		task.status === "done" || /done|completed|closed/i.test(String(task.status || "")),
	);
	const activeTasks = resolvedTasks.filter((task) => task.status !== "done");
	const productivityScore = computeProductivityScore({
		tasks: resolvedTasks,
		completedTasks,
		goals: resolvedGoals,
	});

	const prompt = buildSummaryPrompt({
		tasks: resolvedTasks,
		notes: resolvedNotes,
		goals: resolvedGoals,
		completedTasks,
		activeTasks,
		productivityScore,
	});

	const llmResponse = await callLLM(prompt);
	const summary = llmResponse?.summary || fallbackSummary({
		completedTasks,
		activeTasks,
		goals: resolvedGoals,
		notes: resolvedNotes,
		productivityScore,
	});

	return {
		success: true,
		summary,
		productivityScore,
		provider: llmResponse?.provider || "demo",
		generatedAt: new Date().toISOString(),
		insights: {
			completedTasks: completedTasks.length,
			activeTasks: activeTasks.length,
			goalCount: resolvedGoals.length,
		},
	};
}

function computeProductivityScore({ tasks = [], completedTasks = [], goals = [] }) {
	const totalTasks = tasks.length || 1;
	const doneRatio = (completedTasks.length || 0) / totalTasks;
	const goalRatio = goals.length ? Math.min(1, (completedTasks.length || 0) / goals.length) : 0.5;
	const score = Math.round((doneRatio * 70 + goalRatio * 30) * 100);
	return Math.min(100, Math.max(0, score));
}

function buildSummaryPrompt({ tasks, notes, goals, completedTasks, activeTasks, productivityScore }) {
	const taskSummary = tasks.length
		? tasks
			.map((task) => `- ${task.title || "Untitled task"} (${task.status || "unknown"})`)
			.join("\n")
		: "- No tasks recorded";
	const noteSummary = notes.length
		? notes.map((note) => `- ${String(note).slice(0, 220)}`).join("\n")
		: "- No notes recorded";
	const goalSummary = goals.length
		? goals.map((goal) => `- ${String(goal).slice(0, 220)}`).join("\n")
		: "- No explicit goals";

	return `You are a daily executive assistant. Write a concise end-of-day summary for a professional using the data below. Keep it brief, actionable, and outcomes-focused.\n\nProductivity score: ${productivityScore}/100\n\nCompleted tasks:\n${completedTasks.length}\n\nActive tasks:\n${activeTasks.length}\n\nTasks:\n${taskSummary}\n\nNotes:\n${noteSummary}\n\nGoals:\n${goalSummary}\n\nReturn JSON with keys: summary, priorities, blockers. The summary should be a single paragraph under 150 words.`;
}

async function callLLM(prompt) {
	const openAiKey = process.env.OPENAI_API_KEY;
	const anthropicKey = process.env.ANTHROPIC_API_KEY;

	if (openAiKey) {
		try {
			const response = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${openAiKey}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					messages: [{ role: "user", content: prompt }],
					temperature: 0.4,
				}),
			});

			if (response.ok) {
				const payload = await response.json();
				const content = payload.choices?.[0]?.message?.content || "";
				return {
					provider: "openai",
					summary: parseSummaryResponse(content),
				};
			}
		} catch (error) {
			console.warn("OpenAI summary request failed:", error.message);
		}
	}

	if (anthropicKey) {
		try {
			const response = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": anthropicKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: "claude-3-haiku-20240307",
					max_tokens: 300,
					messages: [{ role: "user", content: prompt }],
				}),
			});

			if (response.ok) {
				const payload = await response.json();
				const content = payload.content?.[0]?.text || "";
				return {
					provider: "anthropic",
					summary: parseSummaryResponse(content),
				};
			}
		} catch (error) {
			console.warn("Anthropic summary request failed:", error.message);
		}
	}

	return null;
}

function parseSummaryResponse(content) {
	if (!content) return "";
	try {
		const parsed = JSON.parse(content);
		if (parsed.summary) return parsed.summary;
	} catch {
		// Ignore malformed JSON and use best effort parsing.
	}

	const lines = String(content)
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(Boolean);
	return lines[0] || content.trim();
}

function fallbackSummary({
	completedTasks,
	activeTasks,
	goals,
	notes,
	productivityScore,
}) {
	const notableGoal = goals[0] ? `Most important goal: ${String(goals[0]).slice(0, 120)}.` : "Keep momentum steady tomorrow.";
	const noteText = notes.length
		? `Recent notes highlight: ${notes.slice(0, 2).map((note) => String(note).slice(0, 80)).join("; ")}.`
		: "The day was well-structured and focused on execution.";
	const doneText = completedTasks.length
		? `Completed ${completedTasks.length} meaningful task(s).`
		: "No tasks were marked complete yet.";
	const nextText = activeTasks.length
		? `Top follow-up: ${String(activeTasks[0].title || activeTasks[0].name || "next item").slice(0, 120)}.`
		: "No immediate blockers require attention.";

	return `Today was productive overall. ${doneText} ${noteText} ${notableGoal} ${nextText} Productivity score: ${productivityScore}/100.`;
}

module.exports = {
	generateExecutiveSummary,
	computeProductivityScore,
};
