const express = require("express");
const { connectProvider, handleWebhook, listConnectors } = require("../services/integrationService");

const router = express.Router();

router.get("/connectors", (req, res) => {
	return res.json({
		success: true,
		connectors: listConnectors(),
	});
});

router.post("/connect/:provider", (req, res) => {
	try {
		const result = connectProvider(req.params.provider, {
			code: req.body?.code,
			redirectUri: req.body?.redirectUri,
		});
		return res.json(result);
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Unable to connect provider.",
		});
	}
});

router.post("/webhooks/:provider", (req, res) => {
	try {
		const result = handleWebhook(req.params.provider, req.body || {});
		return res.json(result);
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Unable to process webhook.",
		});
	}
});

module.exports = router;
