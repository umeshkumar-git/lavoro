require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ✅ 1. CORS Configuration
// Restricted to your personal domains for security
app.use(
	cors({
		origin: [
			"https://lavoro.umeshshah.in",
			"https://umeshshah.in",
			"https://www.umeshshah.in",
			"http://localhost:3000",
			"http://localhost:5173",
		],
		methods: ["GET", "POST"],
	})
);

app.use(express.json());

// ✅ 2. Initialize Gemini
let model;

try {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error(
			"GEMINI_API_KEY is missing from environment variables."
		);
	}

	const genAI = new GoogleGenerativeAI(apiKey);

	// Using the April 2026 stable preview name
	model = genAI.getGenerativeModel({
		model: "gemini-3-flash-preview",
		systemInstruction:
			"You are Lavoro, Umesh's professional personal assistant. Keep responses concise and helpful.",
	});

	console.log("✅ Gemini AI initialized successfully.");
} catch (err) {
	console.error("❌ Critical Initialization Error:", err.message);
}

// ✅ 3. Health Check
app.get("/", (req, res) => {
	res.send("Lavoro Backend is Online 🚀");
});

// ✅ 4. Chat API
app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res
				.status(400)
				.json({ success: false, message: "No message provided." });
		}

		if (!model) {
			return res
				.status(503)
				.json({ success: false, message: "AI model not initialized." });
		}

		// Generate response
		const result = await model.generateContent(message);
		const response = await result.response;
		const text = response.text();

		res.json({
			success: true,
			message: text,
		});
	} catch (error) {
		console.error("❌ Chat API Error:", error.message);

		// Check for common 404/model errors
		const errorMessage = error.message.includes("404")
			? "Model version outdated. Please check gemini-api settings."
			: "Lavoro is temporarily unavailable.";

		res.status(500).json({
			success: false,
			message: errorMessage,
			details: error.message,
		});
	}
});

// ✅ 5. Start Server
// Port 10000 is the standard for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
	console.log(`-----------------------------------------`);
	console.log(`Lavoro Server running on Port: ${PORT}`);
	console.log(`Domain: https://api.lavoro.umeshshah.in`);
	console.log(`-----------------------------------------`);
});
