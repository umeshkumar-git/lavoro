const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ✅ CORS (allow your frontend)
app.use(cors({
  origin: "https://umeshshah.in"
}));

// ✅ Middleware
app.use(express.json());

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Lavoro backend is running 🚀");
});

// ✅ Chat API (IMPORTANT for your frontend)
app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  // simple test response (you can replace with AI logic)
  res.json({
    success: true,
    message: `You said: ${message}`
  });
});

// ✅ Reset API
app.post("/api/reset", (req, res) => {
  res.json({
    success: true,
    message: "Chat reset successful"
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});