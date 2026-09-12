const { randomUUID } = require("node:crypto");

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
	return jobs.get(jobId) || null;
}

module.exports = {
	enqueueJob,
	getJob,
	jobs,
};
