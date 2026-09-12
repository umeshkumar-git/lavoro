const express = require("express");
const { indexDocuments, queryDocuments } = require("../services/ragService");

const router = express.Router();

router.post("/index", (req, res) => {
	try {
		const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
		const indexed = indexDocuments(documents);
		return res.json({
			success: true,
			indexed: indexed.length,
			documents: indexed,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Unable to index documents.",
		});
	}
});

router.post("/query", (req, res) => {
	try {
		const query = String(req.body?.query || "").trim();
		if (!query) {
			return res.status(400).json({
				success: false,
				message: "A query is required.",
			});
		}

		return res.json({
			success: true,
			results: queryDocuments(query, Number(req.body?.limit || 5)),
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Unable to query documents.",
		});
	}
});

module.exports = router;
