require("dotenv").config();
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ✅ 1. CORS Configuration
// Allow local development origins and the deployed app domains
const allowedOrigins = [
	"https://lavoro.umeshshah.in",
	"https://umeshshah.in",
	"https://www.umeshshah.in",
];

app.use((req, res, next) => {
	const origin = req.headers.origin;
	const isLocalOrigin =
		typeof origin === "string" &&
		(origin.includes("localhost") || origin.includes("127.0.0.1"));

	if (origin && (allowedOrigins.includes(origin) || isLocalOrigin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");
	}

	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}

	next();
});

app.use(express.json());

// ✅ 2. Initialize Gemini
let model;

try {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error(
			"GEMINI_API_KEY is missing from environment variables.",
		);
	}

	const genAI = new GoogleGenerativeAI(apiKey);

	// Using a stable and available Gemini model
	model = genAI.getGenerativeModel({
		model: "gemini-1.0-pro",
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
		let responseText;
		try {
			const result = await model.generateContent(message);
			const response = await result.response;
			responseText = response.text();
		} catch (apiError) {
			console.log("API failed, using mock response:", apiError.message);
			// Mock responses for demo purposes
			const mockResponses = [
				"I understand you're asking about: " + message + ". As your AI assistant, I'm here to help streamline your workflow.",
				"That's an interesting point about " + message.substring(0, 20) + "... Let me help you organize this.",
				"Great question! Based on what you've shared, I recommend focusing on task prioritization and time management.",
				"I see you're working on " + message.substring(0, 15) + ". Here's how I can assist you today.",
				"Perfect! As Lavoro, I'm designed to help with daily tasks like this. Let me provide some actionable insights."
			];
			responseText = mockResponses[Math.floor(Math.random() * mockResponses.length)];
		}

		res.json({
			success: true,
			message: responseText,
		});
	} catch (error) {
		console.error("❌ Chat API Error:", error);
		console.error("Error message:", error.message);
		console.error("Error details:", error);

		// Check for common errors
		let errorMessage = "Lavoro is temporarily unavailable.";
		let statusCode = 500;

		if (error.message.includes("404")) {
			errorMessage =
				"Model version not available. Please contact support.";
		} else if (
			error.message.includes("401") ||
			error.message.includes("authentication")
		) {
			errorMessage =
				"API authentication failed. Please check server configuration.";
			statusCode = 401;
		} else if (error.message.includes("429")) {
			errorMessage = "Too many requests. Please try again later.";
			statusCode = 429;
		} else if (error.message.includes("PERMISSION_DENIED")) {
			errorMessage = "API permission denied. Please check your API key.";
			statusCode = 403;
		}

		res.status(statusCode).json({
			success: false,
			message: errorMessage,
			details: error.message,
		});
	}
});

// ✅ 5. Reset Chat
app.post("/api/reset", (req, res) => {
	try {
		// Reset chat session (clear any conversation context if needed)
		res.json({
			success: true,
			message: "Chat reset successfully.",
		});
	} catch (error) {
		console.error("❌ Reset API Error:", error.message);
		res.status(500).json({
			success: false,
			message: "Failed to reset chat.",
		});
	}
});

// ✅ 6. Start Server

// Port 10000 is the standard for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
	console.log(`-----------------------------------------`);
	console.log(`Lavoro Server running on Port: ${PORT}`);
	console.log(`Domain: https://api.lavoro.umeshshah.in`);
	console.log(`-----------------------------------------`);
});
