require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ✅ CORS
app.use(
	cors({
		origin: ["https://umeshshah.in", "https://www.umeshshah.in"],
		methods: ["GET", "POST"],
		allowedHeaders: ["Content-Type"],
	})
);

app.use(express.json());

// ✅ Health check
app.get("/", (req, res) => {
	res.send("Lavoro backend is running 🚀");
});

// ✅ Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Chat API (FIXED)
app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res.status(400).json({
				success: false,
				message: "Message is required",
			});
		}

		const model = genAI.getGenerativeModel({
			model: "gemini-pro",
		});

		const result = await model.generateContent({
			contents: [
				{
					role: "user",
					parts: [{ text: message }],
				},
			],
		});

		const text = result.response.text();

		res.json({
			success: true,
			message: text,
		});
	} catch (error) {
		console.error("FULL ERROR:", error);

		res.status(500).json({
			success: false,
			message: error.message || "AI failed",
		});
	}
});

// ✅ Reset API
app.post("/api/reset", (req, res) => {
	res.json({
		success: true,
		message: "Chat reset successful",
	});
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
