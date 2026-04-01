const express = require("express");
const cors = require("cors");

const app = express();

// ✅ Proper CORS config
app.use(
	cors({
		origin: "https://umeshshah.in",
		methods: ["GET", "POST"],
		allowedHeaders: ["Content-Type"],
	})
);

app.use(express.json());

// Test route
app.get("/", (req, res) => {
	res.send("Lavoro backend is running 🚀");
});

// Chat route
app.post("/api/chat", (req, res) => {
	const { message } = req.body;

	res.json({
		success: true,
		message: `You said: ${message}`,
	});
});

// Reset route
app.post("/api/reset", (req, res) => {
	res.json({
		success: true,
		message: "Chat reset successful",
	});
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
