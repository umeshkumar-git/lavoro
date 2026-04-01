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
app.post("/api/chat", (req, res) => {
	const { message } = req.body;

	res.json({
		success: true,
		message: `You said: ${message}`,
	});
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
