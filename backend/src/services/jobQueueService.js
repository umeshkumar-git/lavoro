const { randomUUID } = require("node:crypto");
const { getDb } = require("../db");

/**
 * In-memory fallback map used only when DATABASE_URL is unset.
 */
const jobs = new Map();

function normalizeJob(type, payload) {
	return {
		id: randomUUID(),
		type,
		payload,
		status: "queued",
		queuedAt: new Date().toISOString(),
	};
}

function enqueueJob(type, payload = {}) {
	const job = normalizeJob(type, payload);
	const db = getDb();

	if (db) {
		db.prepare(`
			INSERT INTO jobs (id, type, payload_json, status, result_json, queued_at, started_at, completed_at)
			VALUES (@id, @type, @payloadJson, @status, @resultJson, @queuedAt, @startedAt, @completedAt)
		`).run({
			id: job.id,
			type: job.type,
			payloadJson: JSON.stringify(job.payload || {}),
			status: job.status,
			resultJson: null,
			queuedAt: job.queuedAt,
			startedAt: null,
			completedAt: null,
		});

		queueMicrotask(async () => {
			try {
				const currentDb = getDb();
				if (!currentDb) return;

				const startedAt = new Date().toISOString();
				currentDb
					.prepare("UPDATE jobs SET status = ?, started_at = ? WHERE id = ?")
					.run("processing", startedAt, job.id);

				await new Promise((resolve) => setTimeout(resolve, 150));

				const completedDb = getDb();
				if (!completedDb) return;

				const completedAt = new Date().toISOString();
				const result = {
					type,
					processedBy: "queue-worker",
					message: `${type} job completed successfully.`,
					payload,
				};

				completedDb
					.prepare(
						"UPDATE jobs SET status = ?, completed_at = ?, result_json = ? WHERE id = ?",
					)
					.run("completed", completedAt, JSON.stringify(result), job.id);
			} catch (_) {}
		});

		return job;
	}

	jobs.set(job.id, job);

	queueMicrotask(async () => {
		const activeJob = jobs.get(job.id);
		if (!activeJob) return;

		activeJob.status = "processing";
		activeJob.startedAt = new Date().toISOString();

		await new Promise((resolve) => setTimeout(resolve, 150));
		const completedJob = jobs.get(job.id);
		if (!completedJob) return;

		completedJob.status = "completed";
		completedJob.completedAt = new Date().toISOString();
		completedJob.result = {
			type,
			processedBy: "queue-worker",
			message: `${type} job completed successfully.`,
			payload,
		};
	});

	return job;
}

function getJob(jobId) {
	if (!jobId) return null;

	const db = getDb();
	if (db) {
		const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
		if (!row) return null;

		return {
			id: row.id,
			type: row.type,
			payload: JSON.parse(row.payload_json || "{}"),
			status: row.status,
			result: row.result_json ? JSON.parse(row.result_json) : null,
			queuedAt: row.queued_at,
			startedAt: row.started_at,
			completedAt: row.completed_at,
		};
	}

	return jobs.get(jobId) || null;
}

function clearJobs() {
	const db = getDb();
	if (db) {
		db.prepare("DELETE FROM jobs").run();
	}
	jobs.clear();
}

module.exports = {
	clearJobs,
	enqueueJob,
	getJob,
	jobs,
};
