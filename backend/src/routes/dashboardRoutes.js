const express = require("express");
const { getDashboardSummary } = require("../services/dashboardService");

const router = express.Router();

router.get("/summary", async (req, res) => {
	try {
		const sessionId = req.headers["x-session-id"] || req.ip || "default-session";
		const summary = await getDashboardSummary(sessionId);
		return res.json(summary);
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Unable to load dashboard summary.",
		});
	}
});

module.exports = router;
