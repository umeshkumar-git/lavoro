const AI_MODES = {
	learn: {
		label: "Learn",
		description: "Teach concepts with examples, mental models, mistakes, and exercises.",
		keywords: ["learn", "teach", "explain", "concept", "understand", "what is"],
		responseGuide:
			"Use: simple explanation, mental model, example, common mistakes, practical example, small exercise, optional deeper explanation.",
	},
	debug: {
		label: "Debug",
		description: "Diagnose errors from symptoms, logs, stack traces, and code.",
		keywords: ["debug", "error", "stack", "bug", "broken", "failing", "exception"],
		responseGuide:
			"Separate confirmed, likely, and possible causes. Ask for missing evidence when needed. Provide the smallest useful fix and prevention advice.",
	},
	review: {
		label: "Code Review",
		description: "Review code for correctness, maintainability, performance, security, architecture, and tests.",
		keywords: ["review", "code review", "refactor", "feedback", "edge case"],
		responseGuide:
			"Lead with findings by severity: Critical, High, Medium, Low, Suggestion. Avoid style-only criticism unless it affects maintainability.",
	},
	pair: {
		label: "Pair Programmer",
		description: "Design and implement incrementally with explanations.",
		keywords: ["build", "implement", "pair", "feature", "write code", "create"],
		responseGuide:
			"Break work into small steps, explain decisions, give code only when it is useful, and mention tests or validation.",
	},
	project: {
		label: "Project Mentor",
		description: "Turn project ideas into specs, architecture, milestones, and execution plans.",
		keywords: ["project", "milestone", "architecture", "roadmap", "full-stack", "spec"],
		responseGuide:
			"Clarify product goals, functional and non-functional requirements, architecture, APIs, data model, testing, deployment, and milestones.",
	},
	interview: {
		label: "Interview",
		description: "Run interview practice without revealing answers too early.",
		keywords: ["interview", "dsa", "system design interview", "question", "leetcode"],
		responseGuide:
			"Act like an interviewer. Ask one question, let the student answer, evaluate, score, and then give targeted improvement advice.",
	},
	systemDesign: {
		label: "System Design",
		description: "Teach scalable architecture reasoning from requirements to tradeoffs.",
		keywords: ["system design", "design youtube", "design instagram", "scale", "distributed"],
		responseGuide:
			"Guide through requirements, scale, APIs, data model, caching, queues, storage, reliability, observability, security, and tradeoffs.",
	},
	planner: {
		label: "Daily Planner",
		description: "Plan the day with calendar, email, tasks, reminders, and focus blocks.",
		keywords: [
			"plan my day",
			"meetings",
			"calendar",
			"email",
			"priority",
			"task",
			"schedule",
		],
		responseGuide:
			"Summarize the day, identify urgent items, recommend a sequence of work, and keep schedule suggestions realistic.",
	},
};

const DEFAULT_MODE = "learn";
const VALID_LEVELS = new Set(["beginner", "intermediate", "advanced", "interview"]);
const VALID_TEACHING_STYLES = new Set(["socratic", "direct", "beginner", "expert"]);

function normalizeMode(mode) {
	if (mode && AI_MODES[mode]) return mode;
	return DEFAULT_MODE;
}

function detectMode(message, requestedMode) {
	if (requestedMode && requestedMode !== "auto") {
		return normalizeMode(requestedMode);
	}

	const normalized = String(message || "").toLowerCase();
	const match = Object.entries(AI_MODES).find(([, mode]) =>
		mode.keywords.some((keyword) => normalized.includes(keyword)),
	);

	return match ? match[0] : DEFAULT_MODE;
}

function normalizeLevel(level) {
	return VALID_LEVELS.has(level) ? level : "intermediate";
}

function normalizeTeachingStyle(style) {
	return VALID_TEACHING_STYLES.has(style) ? style : "direct";
}

module.exports = {
	AI_MODES,
	DEFAULT_MODE,
	detectMode,
	normalizeLevel,
	normalizeMode,
	normalizeTeachingStyle,
};
