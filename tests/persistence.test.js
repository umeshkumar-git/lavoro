const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("../backend/node_modules/bcrypt");

const { initDatabase, closeDatabase, getDb } = require("../backend/src/db");
const {
	createUser,
	findByEmail,
	findById,
	clearUsers,
} = require("../backend/src/repositories/userRepository");
const {
	loginUser,
	rotateRefreshToken,
	clearRefreshTokens,
} = require("../backend/src/services/authService");
const {
	getSession,
	getTasks,
	addTask,
	getReminders,
	addReminder,
	createDailyPlan,
	getPlans,
	appendMessage,
	getConversation,
	updateProfile,
	resetSession,
} = require("../backend/src/data/store");
const {
	indexDocuments,
	queryDocuments,
	clearDocuments,
} = require("../backend/src/services/ragService");
const {
	enqueueJob,
	getJob,
	clearJobs,
} = require("../backend/src/services/jobQueueService");

const TEST_DB_PATH = path.resolve(__dirname, "test-persistence.db");

function cleanupTestDb() {
	closeDatabase();
	for (const ext of ["", "-wal", "-shm", "-journal"]) {
		const p = `${TEST_DB_PATH}${ext}`;
		if (fs.existsSync(p)) {
			try {
				fs.unlinkSync(p);
			} catch (_) {}
		}
	}
}

before(() => {
	cleanupTestDb();
	initDatabase({ url: `sqlite://${TEST_DB_PATH}`, force: true });
});

after(() => {
	cleanupTestDb();
});

test("database initialization creates all required tables and migration records", () => {
	const db = getDb();
	assert.ok(db, "database should be active");

	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table'")
		.all()
		.map((r) => r.name);

	const expectedTables = [
		"_migrations",
		"users",
		"refresh_tokens",
		"sessions",
		"tasks",
		"reminders",
		"plans",
		"messages",
		"memories",
		"rag_documents",
		"jobs",
	];

	for (const table of expectedTables) {
		assert.ok(
			tables.includes(table),
			`table '${table}' should exist in database`,
		);
	}

	const migrations = db.prepare("SELECT name FROM _migrations").all();
	assert.equal(
		migrations.length,
		4,
		"all 4 migrations should be recorded as applied",
	);
});

test("users are persisted to SQLite with bcrypt password hashing", async () => {
	const email = "persisted-user@example.com";
	const plaintext = "secure-test-pass-123";

	const created = await createUser({
		email,
		password: plaintext,
		name: "Persisted User",
		role: "user",
	});

	assert.equal(created.email, email);
	assert.notEqual(created.password, plaintext);
	assert.ok(
		created.password.startsWith("$2b$") || created.password.startsWith("$2a$"),
		"password must be a bcrypt hash",
	);

	const byEmail = findByEmail(email);
	assert.ok(byEmail, "user should be found by email");
	assert.equal(byEmail.name, "Persisted User");

	const byId = findById(created.id);
	assert.ok(byId, "user should be found by ID");
	assert.equal(byId.email, email);

	const matches = await bcrypt.compare(plaintext, byEmail.password);
	assert.equal(matches, true, "hashed password should verify with bcrypt");
});

test("sessions, tasks, reminders, plans, and messages persist across simulated restart", () => {
	const sessionId = "session-restart-test";

	// 1. Seed initial data
	updateProfile(sessionId, {
		name: "Restart Tester",
		goal: "Test database survival across process restart",
	});

	addTask(sessionId, {
		title: "Survive database reload",
		priority: "high",
		category: "resilience",
	});

	addReminder(sessionId, {
		title: "Verify persistence at 10:00 AM",
		when: "tomorrow 10:00",
	});

	createDailyPlan(sessionId, "Plan for resilience testing");

	appendMessage(sessionId, {
		role: "user",
		content: "Will you remember this after server restart?",
	});
	appendMessage(sessionId, {
		role: "assistant",
		content: "Yes, because all state is persisted in SQLite.",
	});

	// 2. Simulate Server Process Restart / DB Close & Re-open
	closeDatabase();

	// Reopen the exact same SQLite database file
	const reopenedDb = initDatabase({
		url: `sqlite://${TEST_DB_PATH}`,
		force: true,
	});
	assert.ok(reopenedDb, "database should successfully re-open");

	// 3. Verify that everything survived
	const session = getSession(sessionId);
	assert.equal(session.profile.name, "Restart Tester");
	assert.equal(
		session.profile.goal,
		"Test database survival across process restart",
	);

	const tasks = getTasks(sessionId);
	const targetTask = tasks.find((t) => t.title === "Survive database reload");
	assert.ok(targetTask, "custom task should survive database restart");
	assert.equal(targetTask.priority, "high");

	const reminders = getReminders(sessionId);
	const targetReminder = reminders.find(
		(r) => r.title === "Verify persistence at 10:00 AM",
	);
	assert.ok(targetReminder, "custom reminder should survive database restart");

	const plans = getPlans(sessionId);
	assert.ok(plans.length > 0, "daily plan should survive database restart");
	assert.match(plans[0].prompt, /resilience testing/);

	const conversation = getConversation(sessionId);
	assert.equal(conversation.length, 2, "conversation history should survive");
	assert.equal(conversation[0].content, "Will you remember this after server restart?");
	assert.equal(conversation[1].content, "Yes, because all state is persisted in SQLite.");
});

test("refresh tokens are stored in SQLite and support atomic rotation", async () => {
	const email = "token-user@example.com";
	const password = "token-password-456";

	await createUser({
		email,
		password,
		name: "Token User",
		role: "user",
	});

	const loginResult = await loginUser({ email, password });
	assert.ok(loginResult.tokens?.refreshToken);

	const initialRefreshToken = loginResult.tokens.refreshToken;
	const db = getDb();

	const storedRow = db
		.prepare("SELECT * FROM refresh_tokens WHERE token = ?")
		.get(initialRefreshToken);
	assert.ok(storedRow, "refresh token should be in refresh_tokens table");
	assert.equal(storedRow.user_id, loginResult.user.id);

	// Rotate the refresh token
	const nextTokens = rotateRefreshToken(initialRefreshToken);
	assert.ok(nextTokens.refreshToken);
	assert.notEqual(nextTokens.refreshToken, initialRefreshToken);

	// Old token should be deleted
	const oldRow = db
		.prepare("SELECT * FROM refresh_tokens WHERE token = ?")
		.get(initialRefreshToken);
	assert.equal(oldRow, undefined, "old token should be removed from database");

	// New token should be present
	const newRow = db
		.prepare("SELECT * FROM refresh_tokens WHERE token = ?")
		.get(nextTokens.refreshToken);
	assert.ok(newRow, "new rotated token should exist in database");

	// Re-using old token must fail
	assert.throws(
		() => rotateRefreshToken(initialRefreshToken),
		/Refresh token is not recognized/,
	);
});

test("RAG documents are persisted and queried from SQLite", async () => {
	clearDocuments();

	const docs = [
		{
			id: "doc-arch",
			content:
				"The system architecture uses SQLite with WAL mode for fast local persistence.",
			metadata: { category: "architecture" },
		},
		{
			id: "doc-deploy",
			content:
				"Deployment runs via Docker container with automated health check probes.",
			metadata: { category: "devops" },
		},
	];

	await indexDocuments(docs);

	const db = getDb();
	const count = db
		.prepare("SELECT count(*) as count FROM rag_documents")
		.get().count;
	assert.equal(count, 2, "2 documents should be in rag_documents table");

	const results = await queryDocuments("Tell me about SQLite persistence and WAL mode", 2);
	assert.ok(results.length > 0, "should return matching document");
	assert.equal(results[0].id, "doc-arch");
	assert.ok(results[0].score > 0, "score should be positive");
});

test("long documents are chunked with overlapping windows and metadata", async () => {
	clearDocuments();

	const longContent = [
		"First Section: Architecture overview of the Lavoro personal productivity assistant. The application structures its modules cleanly into separate domains.",
		"Second Section: Data persistence uses SQLite with Write-Ahead Logging to guarantee transaction isolation and immediate disk durability without background servers.",
		"Third Section: Retrieval Augmented Generation uses neural embeddings to index workspace notes and project documents for high-accuracy semantic search.",
		"Fourth Section: The background job queue handles asynchronous executive report generation and email triage summaries without blocking the main event loop.",
		"Fifth Section: Security enforcement validates role-based access control, stateless JWT access tokens, and atomic refresh token rotation.",
	].join("\n\n");

	const indexed = await indexDocuments([
		{
			id: "doc-large-manual",
			content: longContent,
			metadata: { topic: "engineering-handbook" },
		},
	]);

	assert.ok(
		indexed.length >= 2,
		`document exceeding 500 chars should produce multiple chunks (got ${indexed.length})`,
	);
	assert.ok(
		indexed[0].id.includes("#chunk-0"),
		"chunk ID should include chunk index",
	);
	assert.equal(indexed[0].metadata.parentDocId, "doc-large-manual");
	assert.equal(indexed[0].metadata.topic, "engineering-handbook");

	const hits = await queryDocuments("Write-Ahead Logging SQLite durability", 1);
	assert.ok(hits.length > 0);
	assert.ok(hits[0].content.includes("Write-Ahead Logging"));
});

test("background jobs persist status and completed results in SQLite", async () => {
	clearJobs();

	const job = enqueueJob("nightly-backup", { target: "s3" });
	assert.ok(job.id);

	const db = getDb();
	const initialRow = db.prepare("SELECT * FROM jobs WHERE id = ?").get(job.id);
	assert.ok(initialRow, "job row should exist in jobs table");
	assert.equal(initialRow.status, "queued");

	// Wait for background worker
	await new Promise((resolve) => setTimeout(resolve, 250));

	const completedJob = getJob(job.id);
	assert.ok(completedJob);
	assert.equal(completedJob.status, "completed");
	assert.ok(completedJob.result, "result payload should be populated");
	assert.equal(completedJob.result.processedBy, "queue-worker");
});

test("in-memory fallback path functions properly when DATABASE_URL is unset", async () => {
	// Temporarily close DB and force null
	closeDatabase();
	const fallbackDb = initDatabase({ url: null, force: true });
	assert.equal(fallbackDb, null, "fallback mode should produce null db");

	clearUsers();
	clearRefreshTokens();
	clearDocuments();
	clearJobs();

	// Verify operations succeed using in-memory structures
	const user = await createUser({
		email: "fallback-user@example.com",
		password: "fallback-pass-123",
		name: "Fallback User",
	});
	assert.ok(user.id);
	assert.ok(findByEmail("fallback-user@example.com"));

	const taskList = addTask("mem-session", { title: "In-memory task" });
	assert.ok(taskList.some((t) => t.title === "In-memory task"));

	const indexed = await indexDocuments([
		{ id: "mem-doc-1", content: "In-memory document test" },
	]);
	assert.equal(indexed.length, 1);
	const ragHits = await queryDocuments("In-memory document test");
	assert.ok(ragHits.length > 0);

	const job = enqueueJob("mem-job", { test: true });
	assert.ok(job.id);
	assert.equal(getJob(job.id).status, "queued");

	// Restore SQLite test database for subsequent tests
	initDatabase({ url: `sqlite://${TEST_DB_PATH}`, force: true });
});
