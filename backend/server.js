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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Chat API
app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res.status(400).json({
				success: false,
				message: "Message is required",
			});
		}

		if (!process.env.GEMINI_API_KEY) {
			throw new Error("Missing GEMINI_API_KEY in environment");
		}

		const model = genAI.getGenerativeModel({
			model: "gemini-1.5-flash",
		});

		const result = await model.generateContent(message);

		// ✅ safer parsing
		const text = result?.response?.text();

		if (!text) {
			throw new Error("Empty response from Gemini");
		}

		res.json({
			success: true,
			message: text,
		});
	} catch (error) {
		console.error("❌ Gemini ERROR FULL:", error);

		res.status(500).json({
			success: false,
			message: error.message, // 🔥 show real error
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
