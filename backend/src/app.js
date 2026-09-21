require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const config = require("./config");
const logger = require("./config/logger");
const telemetry = require("./config/telemetry");
const { AIOrchestrator } = require("../src/ai/orchestrator");
const { DemoProvider, GeminiProvider } = require("../src/ai/providers");
const { AI_MODES } = require("../src/ai/modes");
const {
	addReminder,
	addTask,
	createDailyPlan,
	getConversation,
	getPlans,
	getProfile,
	getReminders,
	getTasks,
	resetSession,
	updateProfile,
} = require("./data/store");
const { createRateLimiter } = require("./middleware/rateLimit");
const { validateBody } = require("./middleware/validation");
const {
	profileSchema,
	taskCreateSchema,
	reminderCreateSchema,
	planCreateSchema,
	chatMessageSchema,
} = require("./shared/schemas");
const {
	getProjectStructure,
	readProjectFile,
	searchProject,
} = require("./utils/projectScanner");
const apiRoutes = require("./routes");

const app = express();
app.set("trust proxy", 1);
const frontendDir = config.frontendDir;
const projectRoot = config.projectRoot;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const GEMINI_MODEL_FALLBACKS = [
	GEMINI_MODEL,
	"gemini-3-flash-preview",
	"gemini-3.1-flash-lite",
].filter((modelName, index, models) => models.indexOf(modelName) === index);

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
	logger.info({ model: GEMINI_MODEL }, "Gemini configured.");
} else {
	logger.warn("GEMINI_API_KEY is not set. Lavoro will use demo responses.");
}

const { seedUsers } = require("../scripts/seed");
if (process.env.NODE_ENV !== "production") {
	seedUsers().catch((error) => {
		logger.error({ error }, "Failed to auto-seed demo accounts");
	});
}

app.use((req, res, next) => {
	if (!process.env.BENCHMARK_MODE) {
		logger.info(
			{
				method: req.method,
				url: req.originalUrl,
				host: req.headers.host,
			},
			"Incoming request",
		);
	}
	next();
});

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: [
					"'self'",
					"'unsafe-inline'",
					"https://cdnjs.cloudflare.com",
				],
				styleSrc: [
					"'self'",
					"'unsafe-inline'",
					"https://fonts.googleapis.com",
					"https://cdnjs.cloudflare.com",
				],
				fontSrc: [
					"'self'",
					"https://fonts.gstatic.com",
					"https://cdnjs.cloudflare.com",
				],
				imgSrc: ["'self'", "data:", "blob:"],
				connectSrc: ["'self'"],
			},
		},
		crossOriginEmbedderPolicy: false,
	}),
);

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

			if (isLocal || config.allowedOrigins.has(origin)) {
				return callback(null, true);
			}

			return callback(new Error("Origin is not allowed by CORS."));
		},
		methods: ["GET", "POST", "OPTIONS"],
		allowedHeaders: ["Content-Type", "X-Session-Id", "Authorization"],
	}),
);
app.use(express.json({ limit: "1mb" }));

if (!process.env.BENCHMARK_MODE) {
	app.use("/api", createRateLimiter({ windowMs: 60_000, max: 60 }));
}
app.use("/api", apiRoutes);
app.use(express.static(frontendDir));

const openapiSpec = require("./docs/openapi.json");

app.get("/api/openapi.json", (req, res) => {
	res.json(openapiSpec);
});

app.get("/api/docs", (req, res) => {
	res.send(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Lavoro API Documentation</title>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css">
	<style>
		body { margin: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
		.swagger-ui .topbar { display: none; }
		.swagger-ui { max-width: 1200px; margin: 0 auto; padding: 24px; }
		.swagger-ui .info .title { color: #f8fafc; }
		.swagger-ui .info p, .swagger-ui .info li { color: #94a3b8; }
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
	<script>
		SwaggerUIBundle({
			url: '/api/openapi.json',
			dom_id: '#swagger-ui',
			deepLinking: true,
			presets: [SwaggerUIBundle.presets.apis],
			layout: 'BaseLayout'
		});
	</script>
</body>
</html>`);
});

app.get("/api/health", (req, res) => {
	res.json({
		success: true,
		status: "healthy",
		service: "Lavoro: Personal Daily Assistant",
		frontend: "vanilla-html-css-js",
		backend: "express",
		database: "in-memory",
		auth: "jwt-rotation",
		model: primaryProvider.isConfigured() ? GEMINI_MODEL : "demo",
		modelFallbacks: primaryProvider.isConfigured()
			? GEMINI_MODEL_FALLBACKS
			: [],
	});
});

app.get("/api/ai/modes", (req, res) => {
	res.json({ success: true, modes: AI_MODES });
});

app.get("/api/profile", (req, res) => {
	res.json({ success: true, profile: getProfile(getSessionId(req)) });
});

app.post("/api/profile", validateBody(profileSchema), (req, res) => {
	try {
		const profile = updateProfile(getSessionId(req), req.body);
		res.json({ success: true, profile });
	} catch (error) {
		sendError(res, error);
	}
});

app.get("/api/conversations", (req, res) => {
	res.json({ success: true, messages: getConversation(getSessionId(req)) });
});

app.get("/api/tasks", (req, res) => {
	res.json({ success: true, tasks: getTasks(getSessionId(req)) });
});

app.post("/api/tasks", validateBody(taskCreateSchema), (req, res) => {
	try {
		const tasks = addTask(getSessionId(req), req.body);
		res.json({ success: true, tasks });
	} catch (error) {
		sendError(res, error);
	}
});

app.get("/api/reminders", (req, res) => {
	res.json({ success: true, reminders: getReminders(getSessionId(req)) });
});

app.post("/api/reminders", validateBody(reminderCreateSchema), (req, res) => {
	try {
		const reminders = addReminder(getSessionId(req), req.body);
		res.json({ success: true, reminders });
	} catch (error) {
		sendError(res, error);
	}
});

app.get("/api/plans", (req, res) => {
	res.json({ success: true, plans: getPlans(getSessionId(req)) });
});

app.post("/api/plans", validateBody(planCreateSchema), (req, res) => {
	try {
		const plan = createDailyPlan(getSessionId(req), req.body.prompt || "");
		res.json({ success: true, plan });
	} catch (error) {
		sendError(res, error);
	}
});

app.post("/api/ai/chat", validateBody(chatMessageSchema), async (req, res) => {
	const startedAt = Date.now();
	try {
		const result = await ai.generate({
			...req.body,
			sessionId: getSessionId(req),
		});

		if (!process.env.BENCHMARK_MODE) {
			console.log("ai.chat", {
				mode: result.mode,
				model: result.model,
				latencyMs: result.latencyMs,
				requestLatencyMs: Date.now() - startedAt,
			});
		}

		res.json(result);
	} catch (error) {
		sendError(res, error);
	}
});

app.post("/api/ai/stream", validateBody(chatMessageSchema), async (req, res) => {
	const startedAt = Date.now();
	const sessionId = getSessionId(req);
	res.writeHead(200, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
	});

	try {
		for await (const event of ai.stream({
			...req.body,
			sessionId,
		})) {
			res.write(`data: ${JSON.stringify(event)}\n\n`);
			if (event.type === "done" && !process.env.BENCHMARK_MODE) {
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

app.post("/api/reset", (req, res) => {
	resetSession(getSessionId(req));
	res.json({ success: true, message: "Conversation reset." });
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

function sendError(res, error) {
	const statusCode = error.statusCode || 500;
	if (statusCode >= 500) {
		logger.error({ err: error, statusCode }, "API error");
		telemetry.captureException(error, { statusCode });
	}

	res.status(statusCode).json({
		success: false,
		message: publicErrorMessage(error),
	});
}

function publicErrorMessage(error) {
	if (error.statusCode && error.statusCode < 500) return error.message;
	return "Lavoro is temporarily unavailable. Please try again.";
}

module.exports = app;
