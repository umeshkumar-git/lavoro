const express = require("express");
const { jobSchema } = require("../shared/schemas");
const { enqueueJob, getJob } = require("../services/jobQueueService");

const router = express.Router();

router.post("/", (req, res) => {
	const validation = jobSchema.safeParse(req.body || {});
	if (!validation.success) {
		return res.status(400).json({
			success: false,
			message: validation.error.issues[0]?.message || "Invalid job payload.",
		});
	}

	const job = enqueueJob(validation.data.type, validation.data.payload);
	return res.status(202).json({
		success: true,
		jobId: job.id,
		status: job.status,
		queuedAt: job.queuedAt,
	});
});

router.get("/:jobId", (req, res) => {
	const job = getJob(req.params.jobId);
	if (!job) {
		return res.status(404).json({ success: false, message: "Job not found." });
	}

	return res.json({ success: true, job });
});

module.exports = router;
