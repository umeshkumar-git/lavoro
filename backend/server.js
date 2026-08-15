require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AIOrchestrator } = require("./src/ai/orchestrator");
const { DemoProvider, GeminiProvider } = require("./src/ai/providers");
const { AI_MODES } = require("./src/ai/modes");
const {
	getConversation,
	getProfile,
	resetSession,
	updateProfile,
} = require("./src/data/store");
const { createRateLimiter } = require("./src/middleware/rateLimit");
const {
	getProjectStructure,
	readProjectFile,
	searchProject,
} = require("./src/utils/projectScanner");

const app = express();
const PORT = Number(process.env.PORT || 10000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const GEMINI_MODEL_FALLBACKS = [
	GEMINI_MODEL,
	"gemini-3-flash-preview",
	"gemini-3.1-flash-lite",
].filter((modelName, index, models) => models.indexOf(modelName) === index);
const frontendDir = path.resolve(__dirname, "../frontend");
const projectRoot = path.resolve(__dirname, "..");

const allowedOrigins = new Set([
	"https://lavoro.umeshshah.in",
	"https://umeshshah.in",
	"https://www.umeshshah.in",
	"https://api.lavoro.umeshshah.in",
]);

const primaryProvider = new GeminiProvider({
	apiKey: process.env.GEMINI_API_KEY,
	modelNames: GEMINI_MODEL_FALLBACKS,
	GoogleGenerativeAI,
});
const fallbackProvider = new DemoProvider();
const ai = new AIOrchestrator({
	primaryProvider,
	fallbackProvider,
	getProjectStructure: () => getProjectStructure(projectRoot),
});

if (primaryProvider.isConfigured()) {
	console.log(`Gemini configured. Primary model: ${GEMINI_MODEL}`);
} else {
	console.warn("GEMINI_API_KEY is not set. Developer Mentor AI will use demo responses.");
}

app.use(
	cors({
		origin(origin, callback) {
			if (!origin) return callback(null, true);

			let parsedOrigin;
			try {
				parsedOrigin = new URL(origin);
			} catch {
				return callback(new Error("Invalid request origin."));
			}

			const isLocal =
				parsedOrigin.hostname === "localhost" ||
				parsedOrigin.hostname === "127.0.0.1";

			if (isLocal || allowedOrigins.has(origin)) {
				return callback(null, true);
			}

			return callback(new Error("Origin is not allowed by CORS."));
		},
		methods: ["GET", "POST", "OPTIONS"],
		allowedHeaders: ["Content-Type", "X-Session-Id"],
	}),
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", createRateLimiter({ windowMs: 60_000, max: 60 }));
app.use(express.static(frontendDir));

app.get("/api/health", (req, res) => {
	res.json({
		success: true,
		status: "healthy",
		service: "Developer Mentor AI",
		frontend: "vanilla-html-css-js",
		backend: "express",
		database: "in-memory",
		auth: "none-local-session",
		model: primaryProvider.isConfigured() ? GEMINI_MODEL : "demo",
		modelFallbacks: primaryProvider.isConfigured() ? GEMINI_MODEL_FALLBACKS : [],
	});
});

app.get("/api/ai/modes", (req, res) => {
	res.json({
		success: true,
		modes: AI_MODES,
	});
});

app.get("/api/profile", (req, res) => {
	res.json({
		success: true,
		profile: getProfile(getSessionId(req)),
	});
});

app.post("/api/profile", (req, res) => {
	try {
		const profile = updateProfile(getSessionId(req), sanitizeProfile(req.body));
		res.json({ success: true, profile });
	} catch (error) {
		sendError(res, error);
	}
});

app.get("/api/conversations", (req, res) => {
	res.json({
		success: true,
		messages: getConversation(getSessionId(req)),
	});
});

app.post("/api/ai/chat", async (req, res) => {
	const startedAt = Date.now();
	try {
		const result = await ai.generate({
			...req.body,
			sessionId: getSessionId(req),
		});

		console.log("ai.chat", {
			mode: result.mode,
			model: result.model,
			latencyMs: result.latencyMs,
			requestLatencyMs: Date.now() - startedAt,
		});

		res.json(result);
	} catch (error) {
		sendError(res, error);
	}
});

app.post("/api/ai/stream", async (req, res) => {
	const startedAt = Date.now();
	res.writeHead(200, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
	});

	try {
		for await (const event of ai.stream({
			...req.body,
			sessionId: getSessionId(req),
		})) {
			res.write(`data: ${JSON.stringify(event)}\n\n`);
			if (event.type === "done") {
				console.log("ai.stream", {
					mode: event.mode,
					model: event.model,
					latencyMs: event.latencyMs,
					requestLatencyMs: Date.now() - startedAt,
				});
			}
		}
	} catch (error) {
		res.write(
			`data: ${JSON.stringify({
				type: "error",
				message: publicErrorMessage(error),
			})}\n\n`,
		);
	} finally {
		res.end();
	}
});

app.post("/api/chat", async (req, res) => {
	try {
		const result = await ai.generate({
			...req.body,
			sessionId: getSessionId(req),
		});
		res.json(result);
	} catch (error) {
		sendError(res, error);
	}
});

app.post("/api/reset", (req, res) => {
	resetSession(getSessionId(req));
	res.json({
		success: true,
		message: "Conversation reset.",
	});
});

app.get("/api/project/structure", async (req, res) => {
	try {
		res.json({
			success: true,
			project: await getProjectStructure(projectRoot),
		});
	} catch (error) {
		sendError(res, error);
	}
});

app.get("/api/project/file", async (req, res) => {
	try {
		res.json({
			success: true,
			file: await readProjectFile(projectRoot, req.query.path),
		});
	} catch (error) {
		sendError(res, error);
	}
});

app.get("/api/project/search", async (req, res) => {
	try {
		res.json({
			success: true,
			results: await searchProject(projectRoot, req.query.q),
		});
	} catch (error) {
		sendError(res, error);
	}
});

app.get(/.*/, (req, res) => {
	res.sendFile(path.join(frontendDir, "index.html"));
});

app.use((error, req, res, next) => {
	if (res.headersSent) return next(error);
	return sendError(res, error);
});

function getSessionId(req) {
	return (
		req.headers["x-session-id"] ||
		req.body?.sessionId ||
		req.ip ||
		"default-session"
	);
}

function sanitizeProfile(input = {}) {
	const safe = {};
	const stringFields = [
		"experienceLevel",
		"goal",
		"currentProject",
		"studyTime",
		"targetRole",
		"preferredStyle",
	];
	const listFields = ["languages", "technologies", "strongTopics", "weakTopics"];

	for (const field of stringFields) {
		if (typeof input[field] === "string") {
			safe[field] = input[field].trim().slice(0, 200);
		}
	}

	for (const field of listFields) {
		if (Array.isArray(input[field])) {
			safe[field] = input[field]
				.map((item) => String(item).trim().slice(0, 80))
				.filter(Boolean)
				.slice(0, 20);
		}
	}

	return safe;
}

function sendError(res, error) {
	const statusCode = error.statusCode || 500;
	if (statusCode >= 500) {
		console.error("API error:", error);
	}

	res.status(statusCode).json({
		success: false,
		message: publicErrorMessage(error),
	});
}

function publicErrorMessage(error) {
	if (error.statusCode && error.statusCode < 500) return error.message;
	return "Developer Mentor AI is temporarily unavailable. Please try again.";
}

app.listen(PORT, "0.0.0.0", () => {
	console.log("-----------------------------------------");
	console.log(`Developer Mentor AI is running at http://localhost:${PORT}`);
	console.log(`Health check: http://localhost:${PORT}/api/health`);
	console.log("-----------------------------------------");
});
