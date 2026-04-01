require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ✅ FIXED CORS
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

// ✅ Chat API
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		const model = genAI.getGenerativeModel({
			model: "gemini-1.5-flash",
		});

		const prompt = `
You are a smart personal assistant.
User: ${message}
Give helpful and short response.
`;

		const result = await model.generateContent(prompt);
		const response = await result.response;
		const text = response.text();

		res.json({
			success: true,
			message: text,
		});
	} catch (error) {
		console.error("AI ERROR:", error);

		res.json({
			success: false,
			error: "AI failed",
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
