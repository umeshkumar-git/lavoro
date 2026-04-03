require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ✅ CORS (FIXED)
app.use(
	cors({
		origin: [
			"https://lavoro.umeshshah.in",
			"https://umeshshah.in",
			"https://www.umeshshah.in",
		],
		methods: ["GET", "POST"],
	})
);

app.use(express.json());

// ✅ Health check
app.get("/", (req, res) => {
	res.send("Lavoro backend is running 🚀");
});

// ✅ Gemini setup
// ✅ Chat API
app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res
				.status(400)
				.json({ success: false, message: "Message is required" });
		}

		// 1. Initialize the model with System Instructions
		const model = genAI.getGenerativeModel({
			model: "gemini-1.5-flash",
			systemInstruction:
				"You are Lavoro, Umesh's professional personal assistant. Keep responses concise and helpful.",
		});

		// 2. Generate content and wait for the full response
		const result = await model.generateContent(message);
		const response = await result.response;
		const text = response.text();

		if (!text) {
			throw new Error("Empty response from Gemini");
		}

		res.json({
			success: true,
			message: text,
		});
	} catch (error) {
		console.error("❌ Gemini ERROR:", error);
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});
// ✅ Reset API
app.post("/api/reset", (req, res) => {
	res.json({ success: true });
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
