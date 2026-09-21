const { getDb } = require("../db");

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

/**
 * In-memory fallback map used only when DATABASE_URL is unset.
 */
const sessions = new Map();

function createInMemorySession() {
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

function ensureDbSession(db, sessionId) {
	const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
	if (row) return row;

	const now = new Date().toISOString();
	const initTx = db.transaction(() => {
		db.prepare(`
			INSERT INTO sessions (id, profile_json, created_at, updated_at)
			VALUES (?, ?, ?, ?)
		`).run(sessionId, JSON.stringify(DEFAULT_PROFILE), now, now);

		const insertTask = db.prepare(`
			INSERT INTO tasks (id, session_id, title, priority, status, due, category, created_at)
			VALUES (@id, @sessionId, @title, @priority, @status, @due, @category, @createdAt)
		`);
		for (let i = 0; i < DEFAULT_TASKS.length; i++) {
			const task = DEFAULT_TASKS[i];
			insertTask.run({
				...task,
				sessionId,
				createdAt: new Date(Date.now() - (DEFAULT_TASKS.length - i) * 1000).toISOString(),
			});
		}

		const insertReminder = db.prepare(`
			INSERT INTO reminders (id, session_id, title, when_time, done, created_at)
			VALUES (@id, @sessionId, @title, @whenTime, @done, @createdAt)
		`);
		for (let i = 0; i < DEFAULT_REMINDERS.length; i++) {
			const rem = DEFAULT_REMINDERS[i];
			insertReminder.run({
				id: rem.id,
				sessionId,
				title: rem.title,
				whenTime: rem.when,
				done: rem.done ? 1 : 0,
				createdAt: new Date(Date.now() - (DEFAULT_REMINDERS.length - i) * 1000).toISOString(),
			});
		}
	});

	initTx();
	return db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
}

function getSession(sessionId = "default") {
	const db = getDb();
	if (db) {
		const sessionRow = ensureDbSession(db, sessionId);
		let profile = { ...DEFAULT_PROFILE };
		try {
			profile = JSON.parse(sessionRow.profile_json);
		} catch (_) {}

		const taskRows = db
			.prepare("SELECT * FROM tasks WHERE session_id = ? ORDER BY rowid DESC")
			.all(sessionId);
		const tasks = taskRows.map((row) => ({
			id: row.id,
			title: row.title,
			priority: row.priority,
			status: row.status,
			due: row.due,
			category: row.category,
			createdAt: row.created_at,
		}));

		const reminderRows = db
			.prepare("SELECT * FROM reminders WHERE session_id = ? ORDER BY rowid DESC")
			.all(sessionId);
		const reminders = reminderRows.map((row) => ({
			id: row.id,
			title: row.title,
			when: row.when_time,
			done: Boolean(row.done),
			createdAt: row.created_at,
		}));

		const planRows = db
			.prepare("SELECT * FROM plans WHERE session_id = ? ORDER BY rowid DESC LIMIT 5")
			.all(sessionId);
		const plans = planRows.map((row) => ({
			id: row.id,
			prompt: row.prompt,
			summary: row.summary,
			tasks: JSON.parse(row.tasks_json || "[]"),
			reminders: JSON.parse(row.reminders_json || "[]"),
			createdAt: row.created_at,
		}));

		const memoryRows = db
			.prepare("SELECT * FROM memories WHERE session_id = ? ORDER BY rowid DESC LIMIT 20")
			.all(sessionId);
		const memories = memoryRows.map((row) => ({
			id: row.id,
			createdAt: row.created_at,
			...JSON.parse(row.content_json || "{}"),
		}));

		const messageRows = db
			.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY rowid ASC")
			.all(sessionId);
		const conversations = messageRows.map((row) => ({
			id: row.id,
			role: row.role,
			content: row.content,
			createdAt: row.created_at,
			...(row.metadata_json ? JSON.parse(row.metadata_json) : {}),
		}));

		return {
			profile,
			tasks,
			reminders,
			plans,
			memories,
			conversations,
			projects: [],
			createdAt: sessionRow.created_at,
			updatedAt: sessionRow.updated_at,
		};
	}

	if (!sessions.has(sessionId)) {
		sessions.set(sessionId, createInMemorySession());
	}
	return sessions.get(sessionId);
}

function getProfile(sessionId) {
	return getSession(sessionId).profile;
}

function updateProfile(sessionId, updates = {}) {
	const db = getDb();
	if (db) {
		const session = getSession(sessionId);
		const nextProfile = {
			...session.profile,
			...updates,
			focusAreas: normalizeList(updates.focusAreas, session.profile.focusAreas),
		};

		db.prepare(`
			UPDATE sessions SET profile_json = ?, updated_at = ? WHERE id = ?
		`).run(JSON.stringify(nextProfile), new Date().toISOString(), sessionId);

		return nextProfile;
	}

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
	const db = getDb();
	if (db) {
		ensureDbSession(db, sessionId);
		const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
		const createdAt = new Date().toISOString();
		const role = message.role || "user";
		const content = message.content || "";
		const metadata = { ...message };
		delete metadata.role;
		delete metadata.content;
		delete metadata.id;
		delete metadata.createdAt;

		const tx = db.transaction(() => {
			db.prepare(`
				INSERT INTO messages (id, session_id, role, content, metadata_json, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run(
				id,
				sessionId,
				role,
				content,
				Object.keys(metadata).length ? JSON.stringify(metadata) : null,
				createdAt,
			);

			db.prepare(`
				DELETE FROM messages WHERE session_id = ? AND id NOT IN (
					SELECT id FROM messages WHERE session_id = ? ORDER BY rowid DESC LIMIT ?
				)
			`).run(sessionId, sessionId, MAX_HISTORY_MESSAGES);

			db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
				createdAt,
				sessionId,
			);
		});

		tx();
		return getConversation(sessionId);
	}

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

	const db = getDb();
	if (db) {
		ensureDbSession(db, sessionId);
		const now = new Date().toISOString();

		const tx = db.transaction(() => {
			db.prepare(`
				INSERT INTO tasks (id, session_id, title, priority, status, due, category, created_at)
				VALUES (@id, @sessionId, @title, @priority, @status, @due, @category, @createdAt)
			`).run({
				...nextTask,
				sessionId,
				createdAt: now,
			});

			db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
				now,
				sessionId,
			);
		});

		tx();
		return getTasks(sessionId);
	}

	const session = getSession(sessionId);
	session.tasks.unshift(nextTask);
	session.updatedAt = new Date().toISOString();
	return session.tasks;
}

function getReminders(sessionId) {
	return getSession(sessionId).reminders;
}

function addReminder(sessionId, reminder) {
	const nextReminder = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		title: String(reminder?.title || "Reminder").trim(),
		when: reminder?.when || "today 18:00",
		done: Boolean(reminder?.done),
	};

	if (!nextReminder.title) {
		throw new Error("Reminder title is required.");
	}

	const db = getDb();
	if (db) {
		ensureDbSession(db, sessionId);
		const now = new Date().toISOString();

		const tx = db.transaction(() => {
			db.prepare(`
				INSERT INTO reminders (id, session_id, title, when_time, done, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run(
				nextReminder.id,
				sessionId,
				nextReminder.title,
				nextReminder.when,
				nextReminder.done ? 1 : 0,
				now,
			);

			db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
				now,
				sessionId,
			);
		});

		tx();
		return getReminders(sessionId);
	}

	const session = getSession(sessionId);
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

	const db = getDb();
	if (db) {
		const tx = db.transaction(() => {
			db.prepare(`
				INSERT INTO plans (id, session_id, prompt, summary, tasks_json, reminders_json, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(
				plan.id,
				sessionId,
				plan.prompt,
				plan.summary,
				JSON.stringify(plan.tasks),
				JSON.stringify(plan.reminders),
				plan.createdAt,
			);

			db.prepare(`
				DELETE FROM plans WHERE session_id = ? AND id NOT IN (
					SELECT id FROM plans WHERE session_id = ? ORDER BY rowid DESC LIMIT 5
				)
			`).run(sessionId, sessionId);

			db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
				plan.createdAt,
				sessionId,
			);
		});

		tx();
		return plan;
	}

	session.plans.unshift(plan);
	session.plans = session.plans.slice(0, 5);
	session.updatedAt = new Date().toISOString();
	return plan;
}

function getPlans(sessionId) {
	return getSession(sessionId).plans;
}

function addMemory(sessionId, memory) {
	const nextMemory = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: new Date().toISOString(),
		...memory,
	};

	const db = getDb();
	if (db) {
		ensureDbSession(db, sessionId);
		const content = { ...memory };

		const tx = db.transaction(() => {
			db.prepare(`
				INSERT INTO memories (id, session_id, content_json, created_at)
				VALUES (?, ?, ?, ?)
			`).run(nextMemory.id, sessionId, JSON.stringify(content), nextMemory.createdAt);

			db.prepare(`
				DELETE FROM memories WHERE session_id = ? AND id NOT IN (
					SELECT id FROM memories WHERE session_id = ? ORDER BY rowid DESC LIMIT 20
				)
			`).run(sessionId, sessionId);

			db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
				nextMemory.createdAt,
				sessionId,
			);
		});

		tx();
		return getMemories(sessionId);
	}

	const session = getSession(sessionId);
	session.memories.unshift(nextMemory);
	session.memories = session.memories.slice(0, 20);
	session.updatedAt = new Date().toISOString();
	return session.memories;
}

function getMemories(sessionId) {
	return getSession(sessionId).memories;
}

function resetSession(sessionId) {
	const db = getDb();
	if (db) {
		const tx = db.transaction(() => {
			db.prepare("DELETE FROM tasks WHERE session_id = ?").run(sessionId);
			db.prepare("DELETE FROM reminders WHERE session_id = ?").run(sessionId);
			db.prepare("DELETE FROM plans WHERE session_id = ?").run(sessionId);
			db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
			db.prepare("DELETE FROM memories WHERE session_id = ?").run(sessionId);
			db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
		});
		tx();
		return getSession(sessionId);
	}

	sessions.set(sessionId, createInMemorySession());
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
	DEFAULT_REMINDERS,
	DEFAULT_TASKS,
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
	sessions,
	updateProfile,
};
