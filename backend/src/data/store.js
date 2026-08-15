const MAX_HISTORY_MESSAGES = 24;

const DEFAULT_TASKS = [
	{
		id: "task-demo-1",
		title: "Review authentication flow",
		priority: "high",
		status: "in-progress",
		due: "today",
		category: "project",
	},
	{
		id: "task-demo-2",
		title: "Practice async JavaScript patterns",
		priority: "medium",
		status: "queued",
		due: "tomorrow",
		category: "learning",
	},
];

const DEFAULT_REMINDERS = [
	{
		id: "reminder-demo-1",
		title: "Submit weekly mentor summary",
		when: "tomorrow 18:00",
		done: false,
	},
];

const DEFAULT_PROFILE = {
	experienceLevel: "intermediate",
	languages: ["JavaScript"],
	technologies: ["HTML", "CSS", "Node.js"],
	goal: "Become a professional software engineer",
	currentProject: "Developer Mentor AI",
	studyTime: "45 minutes per day",
	targetRole: "Full-stack developer",
	preferredStyle: "direct",
	strongTopics: [],
	weakTopics: [],
	completedLessons: [],
	interviewScores: [],
	codingMistakes: [],
};

const sessions = new Map();

function createSession() {
	return {
		profile: { ...DEFAULT_PROFILE },
		conversations: [],
		projects: [],
		tasks: DEFAULT_TASKS.map((task) => ({ ...task })),
		reminders: DEFAULT_REMINDERS.map((reminder) => ({ ...reminder })),
		plans: [],
		memories: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

function getSession(sessionId) {
	if (!sessions.has(sessionId)) {
		sessions.set(sessionId, createSession());
	}

	return sessions.get(sessionId);
}

function getProfile(sessionId) {
	return getSession(sessionId).profile;
}

function updateProfile(sessionId, updates) {
	const session = getSession(sessionId);
	const nextProfile = {
		...session.profile,
		...updates,
		languages: normalizeList(updates.languages, session.profile.languages),
		technologies: normalizeList(updates.technologies, session.profile.technologies),
		strongTopics: normalizeList(updates.strongTopics, session.profile.strongTopics),
		weakTopics: normalizeList(updates.weakTopics, session.profile.weakTopics),
	};

	session.profile = nextProfile;
	session.updatedAt = new Date().toISOString();
	return nextProfile;
}

function getConversation(sessionId) {
	return getSession(sessionId).conversations;
}

function appendMessage(sessionId, message) {
	const session = getSession(sessionId);
	session.conversations.push({
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: new Date().toISOString(),
		...message,
	});

	if (session.conversations.length > MAX_HISTORY_MESSAGES) {
		session.conversations.splice(
			0,
			session.conversations.length - MAX_HISTORY_MESSAGES,
		);
	}

	session.updatedAt = new Date().toISOString();
	return session.conversations;
}

function getTasks(sessionId) {
	return getSession(sessionId).tasks;
}

function addTask(sessionId, task) {
	const session = getSession(sessionId);
	const nextTask = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		title: String(task?.title || "Untitled task").trim(),
		priority: task?.priority || "medium",
		status: task?.status || "queued",
		due: task?.due || "later",
		category: task?.category || "general",
	};

	if (!nextTask.title) {
		throw new Error("Task title is required.");
	}

	session.tasks.unshift(nextTask);
	session.updatedAt = new Date().toISOString();
	return session.tasks;
}

function getReminders(sessionId) {
	return getSession(sessionId).reminders;
}

function addReminder(sessionId, reminder) {
	const session = getSession(sessionId);
	const nextReminder = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		title: String(reminder?.title || "Reminder").trim(),
		when: reminder?.when || "tomorrow 09:00",
		done: Boolean(reminder?.done),
	};

	if (!nextReminder.title) {
		throw new Error("Reminder title is required.");
	}

	session.reminders.unshift(nextReminder);
	session.updatedAt = new Date().toISOString();
	return session.reminders;
}

function createDailyPlan(sessionId, prompt = "") {
	const session = getSession(sessionId);
	const tasks = (session.tasks || []).filter((task) => task.status !== "done");
	const reminders = (session.reminders || []).slice(0, 3);
	const focus = tasks.slice(0, 3);
	const summary = focus.length
		? `Focus on ${focus.map((task) => task.title).join(", ")}.`
		: "Take time to review your current goals and keep a short, realistic build block.";

	const plan = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: new Date().toISOString(),
		prompt: String(prompt).trim(),
		summary,
		tasks: focus,
		reminders,
	};

	session.plans.unshift(plan);
	session.plans = session.plans.slice(0, 5);
	session.updatedAt = new Date().toISOString();
	return plan;
}

function getPlans(sessionId) {
	return getSession(sessionId).plans;
}

function addMemory(sessionId, memory) {
	const session = getSession(sessionId);
	session.memories.unshift({
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: new Date().toISOString(),
		...memory,
	});
	session.memories = session.memories.slice(0, 20);
	session.updatedAt = new Date().toISOString();
	return session.memories;
}

function getMemories(sessionId) {
	return getSession(sessionId).memories;
}

function resetSession(sessionId) {
	sessions.set(sessionId, createSession());
	return getSession(sessionId);
}

function normalizeList(value, fallback) {
	if (!Array.isArray(value)) return fallback || [];
	return value
		.map((item) => String(item).trim())
		.filter(Boolean)
		.slice(0, 20);
}

module.exports = {
	DEFAULT_PROFILE,
	addMemory,
	addReminder,
	addTask,
	appendMessage,
	createDailyPlan,
	getConversation,
	getMemories,
	getPlans,
	getProfile,
	getReminders,
	getSession,
	getTasks,
	resetSession,
	updateProfile,
};
