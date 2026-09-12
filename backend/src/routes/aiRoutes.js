const express = require("express");
const { generateExecutiveSummary } = require("../services/executiveSummaryService");

const router = express.Router();

router.post("/daily-summary", async (req, res) => {
	try {
		const result = await generateExecutiveSummary({
			tasks: req.body?.tasks || [],
			notes: req.body?.notes || [],
			goals: req.body?.goals || [],
			sessionId: req.headers["x-session-id"] || req.ip || "default-session",
		});
		return res.json(result);
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Unable to generate daily summary.",
		});
	}
});

module.exports = router;
