require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ✅ 1. CORS Configuration
app.use(
	cors({
		origin: [
			"https://lavoro.umeshshah.in",
			"https://umeshshah.in",
			"https://www.umeshshah.in",
			"http://localhost:3000", // Added for local testing
		],
		methods: ["GET", "POST"],
	})
);

app.use(express.json());

// ✅ 2. Initialize Gemini (This was the missing piece!)
// Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define the model once at the top level for efficiency
const model = genAI.getGenerativeModel({
	model: "gemini-1.5-flash",
	systemInstruction:
		"You are Lavoro, Umesh's professional personal assistant. Keep responses concise and helpful.",
});

// ✅ 3. Health check
app.get("/", (req, res) => {
	res.send("Lavoro backend is running 🚀");
});

// ✅ 4. Chat API
app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res
				.status(400)
				.json({ success: false, message: "Message is required" });
		}

		// Generate content using the model defined above
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
			message: "AI service error. Check backend logs.",
		});
	}
});

// ✅ 5. Reset API (Placeholder for clearing session/history)
app.post("/api/reset", (req, res) => {
	res.json({ success: true, message: "Chat reset successfully" });
});

// ✅ 6. Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
	console.log(`Lavoro server running on port ${PORT}`);
});
