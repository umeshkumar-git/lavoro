const AI_MODES = {
	assistant: {
		label: "Daily Assistant",
		description:
			"Executive personal concierge for scheduling, drafting, questions, and daily priorities.",
		keywords: ["assistant", "help", "what", "how", "organize", "notes", "draft"],
		responseGuide:
			"Be concise, actionable, and structured. Clarify priorities, cite connected data, and offer direct next steps.",
	},
	briefing: {
		label: "Morning Briefing",
		description:
			"Start-of-day executive briefing: weather, calendar schedule, urgent emails, and top tasks.",
		keywords: [
			"briefing",
			"morning briefing",
			"morning",
			"agenda",
			"today's overview",
			"start my day",
			"daily briefing",
		],
		responseGuide:
			"Deliver a polished briefing highlighting weather conditions, calendar events, unread high-priority emails, and key tasks to tackle first.",
	},
	planner: {
		label: "Day Planner",
		description:
			"Time-blocked daily schedule, meeting preparation, and dedicated focus intervals.",
		keywords: [
			"plan my day",
			"planner",
			"time block",
			"schedule",
			"calendar",
			"meetings",
			"deep work",
			"focus block",
		],
		responseGuide:
			"Construct a realistic, time-blocked schedule with deep work blocks, buffer times, and meeting prep based on existing calendar commitments and tasks.",
	},
	tasks: {
		label: "Task Prioritization",
		description:
			"Prioritize tasks using the Eisenhower Matrix, break down projects, and sequence next actions.",
		keywords: [
			"task",
			"tasks",
			"prioritize",
			"to-do",
			"todo",
			"action items",
			"urgent",
			"eisenhower",
		],
		responseGuide:
			"Categorize tasks by urgency and impact, recommend immediate next steps, and suggest optimal sequencing.",
	},
	email: {
		label: "Email Triage",
		description:
			"Summarize inbox messages, identify urgent items, and draft concise responses.",
		keywords: [
			"email",
			"emails",
			"inbox",
			"triage",
			"draft reply",
			"unread messages",
			"sender",
		],
		responseGuide:
			"Highlight senders, subjects, urgency, core requests, and suggested responses or next actions.",
	},
	summary: {
		label: "Executive Summary",
		description:
			"End-of-day retrospective, completed accomplishments, carried-over items, and productivity scoring.",
		keywords: [
			"summary",
			"daily summary",
			"retrospective",
			"wrap up",
			"end of day",
			"score",
			"productivity score",
		],
		responseGuide:
			"Summarize achievements, list remaining items, celebrate focus milestones, and provide an objective productivity assessment.",
	},
};

const DEFAULT_MODE = "assistant";

function normalizeMode(mode) {
	if (mode && AI_MODES[mode]) return mode;
	return DEFAULT_MODE;
}

function detectMode(message, requestedMode) {
	if (requestedMode && requestedMode !== "auto") {
		return normalizeMode(requestedMode);
	}

	const normalized = String(message || "").toLowerCase();

	// Check specialized modes first (briefing, planner, tasks, email, summary)
	const specializedEntries = Object.entries(AI_MODES).filter(
		([key]) => key !== DEFAULT_MODE,
	);
	const specializedMatch = specializedEntries.find(([, mode]) =>
		mode.keywords.some((keyword) => normalized.includes(keyword)),
	);
	if (specializedMatch) {
		return specializedMatch[0];
	}

	// Check assistant keywords
	const assistantMode = AI_MODES[DEFAULT_MODE];
	if (
		assistantMode &&
		assistantMode.keywords.some((keyword) => normalized.includes(keyword))
	) {
		return DEFAULT_MODE;
	}

	return DEFAULT_MODE;
}

module.exports = {
	AI_MODES,
	DEFAULT_MODE,
	detectMode,
	normalizeMode,
};
