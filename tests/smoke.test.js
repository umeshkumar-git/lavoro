const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../backend/src/app");
const { seedUsers, DEV_SEED_PASSWORD } = require("../scripts/seed");

before(async () => {
	await seedUsers();
});

test("health endpoint is available and reports healthy status", async () => {
	const response = await request(app).get("/api/health");
	assert.equal(response.status, 200, "health endpoint should return 200");

	const payload = response.body;
	assert.equal(payload.status, "healthy", "status should be healthy");
	assert.equal(
		payload.service,
		"Lavoro: Personal Daily Assistant",
		"service name should match the app",
	);
	assert.equal(
		payload.frontend,
		"vanilla-html-css-js",
		"frontend should be the static app shell",
	);
});

test("homepage serves the app shell with the premium dashboard HTML", async () => {
	const response = await request(app).get("/");
	assert.equal(response.status, 200, "homepage should return 200");

	const html = response.text;
	assert.match(
		html,
		/Lavoro: Personal Daily Assistant/,
		"page should include the application title",
	);
	assert.match(
		html,
		/app-shell/,
		"page should render the app shell container",
	);
	assert.match(html, /chatMessages/, "chat container should be present");
});

test("dashboard summary is served through the cache-friendly metrics endpoint", async () => {
	const response = await request(app).get("/api/dashboard/summary");
	assert.equal(
		response.status,
		200,
		"dashboard summary should be accessible",
	);

	const payload = response.body;
	assert.equal(payload.success, true, "dashboard summary should succeed");
	assert.ok(payload.metrics, "dashboard summary should have metrics");
	assert.equal(
		typeof payload.cached,
		"boolean",
		"cached should be a boolean",
	);
});

test("login returns JWT tokens and protected routes require authentication", async () => {
	const loginResponse = await request(app)
		.post("/api/auth/login")
		.send({
			email: "admin@example.com",
			password: DEV_SEED_PASSWORD,
		});
	assert.equal(loginResponse.status, 200, "login should succeed");

	const loginPayload = loginResponse.body;
	assert.ok(
		loginPayload.tokens?.accessToken,
		"access token should be present",
	);
	assert.ok(
		loginPayload.tokens?.refreshToken,
		"refresh token should be present",
	);

	const protectedResponse = await request(app)
		.get("/api/auth/me")
		.set("Authorization", `Bearer ${loginPayload.tokens.accessToken}`);
	assert.equal(
		protectedResponse.status,
		200,
		"me endpoint should authorize the token",
	);

	const unauthenticatedResponse = await request(app).get("/api/auth/me");
	assert.equal(
		unauthenticatedResponse.status,
		401,
		"missing token should be rejected",
	);
});

test("background queue endpoint accepts async jobs with a job identifier", async () => {
	const response = await request(app)
		.post("/api/jobs")
		.send({
			type: "daily-summary",
			payload: { userId: "demo-user" },
		});
	assert.equal(response.status, 202, "job request should be accepted");

	const payload = response.body;
	assert.ok(payload.jobId, "job ID should be returned");
	assert.equal(payload.status, "queued", "job should start in queued state");
});

test("daily executive summary generates a summary and productivity score", async () => {
	const response = await request(app)
		.post("/api/ai/daily-summary")
		.send({
			tasks: [
				{ title: "Ship backend auth", status: "done" },
				{ title: "Refine dashboard metrics", status: "in-progress" },
			],
			notes: [
				"Completed auth and rate limiting.",
				"Need follow-up for access tokens.",
			],
			goals: ["Ship auth", "Review metric caching"],
		});
	assert.equal(response.status, 200, "summary endpoint should return 200");

	const payload = response.body;
	assert.ok(payload.summary, "summary text should be present");
	assert.ok(
		typeof payload.productivityScore === "number",
		"score should be numeric",
	);
	assert.ok(
		payload.productivityScore >= 0 && payload.productivityScore <= 100,
		"score should be in range",
	);
});

test("RAG query can index and retrieve relevant historical context", async () => {
	const indexResponse = await request(app)
		.post("/api/rag/index")
		.send({
			documents: [
				{
					id: "doc-1",
					content:
						"Project launch plan includes auth flow, dashboard metrics, and daily summaries.",
				},
				{
					id: "doc-2",
					content:
						"Weekly retrospective notes mention reducing time to ship by improving team coordination.",
				},
			],
		});
	assert.equal(indexResponse.status, 200, "rag index request should succeed");

	const queryResponse = await request(app)
		.post("/api/rag/query")
		.send({
			query: "What does the launch plan mention about auth and dashboards?",
		});
	assert.equal(queryResponse.status, 200, "rag query should succeed");

	const payload = queryResponse.body;
	assert.ok(Array.isArray(payload.results), "results should be an array");
	assert.ok(
		payload.results.length > 0,
		"at least one result should be returned",
	);
});

test("third-party integration endpoints expose supported connectors and webhook handling", async () => {
	const connectorsResponse = await request(app).get(
		"/api/integrations/connectors",
	);
	assert.equal(
		connectorsResponse.status,
		200,
		"connectors route should succeed",
	);
	const connectorsPayload = connectorsResponse.body;
	assert.ok(
		Array.isArray(connectorsPayload.connectors),
		"connector list should be available",
	);

	const webhookResponse = await request(app)
		.post("/api/integrations/webhooks/slack")
		.send({
			type: "event_callback",
			text: "summary ready",
		});
	assert.equal(
		webhookResponse.status,
		200,
		"webhook route should accept events",
	);
	const webhookPayload = webhookResponse.body;
	assert.equal(
		webhookPayload.success,
		true,
		"webhook response should succeed",
	);
});
