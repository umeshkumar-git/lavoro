const MAX_HISTORY_MESSAGES = 24;

const DEFAULT_TASKS = [
	{
		id: "task-demo-1",
		title: "Review daily schedule and prioritize urgent emails",
		priority: "high",
		status: "in-progress",
		due: "today",
		category: "planning",
	},
	{
		id: "task-demo-2",
		title: "Prepare briefing notes for client review call",
		priority: "high",
		status: "queued",
		due: "today",
		category: "meetings",
	},
	{
		id: "task-demo-3",
		title: "Review team productivity metrics and project deliverables",
		priority: "medium",
		status: "queued",
		due: "tomorrow",
		category: "review",
	},
];

const DEFAULT_REMINDERS = [
	{
		id: "reminder-demo-1",
		title: "Team Standup at 09:00 AM",
		when: "today 09:00",
		done: false,
	},
	{
		id: "reminder-demo-2",
		title: "Review end-of-day productivity summary",
		when: "today 18:00",
		done: false,
	},
];

const DEFAULT_PROFILE = {
	name: "Umesh Kumar",
	role: "Professional",
	timezone: "Asia/Kolkata",
	workingHours: "09:00 - 18:00",
	goal: "Execute daily priorities efficiently and maintain focus",
	focusAreas: ["Deep Work", "Project Delivery", "Communication"],
	preferredSummaryStyle: "concise",
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
		focusAreas: normalizeList(updates.focusAreas, session.profile.focusAreas),
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
		when: reminder?.when || "today 18:00",
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
	const tasks = (session.tasks || []).filter(
		(task) => task.status !== "done",
	);
	const reminders = (session.reminders || []).slice(0, 3);
	const focus = tasks.slice(0, 3);
	const summary = focus.length
		? `Focus on ${focus.map((task) => task.title).join(", ")}.`
		: "Plan your day around your core commitments and dedicated deep work intervals.";

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
