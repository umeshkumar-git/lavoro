const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../../backend/src/app");

test("helmet applies standard security headers across HTTP responses", async () => {
	const res = await request(app).get("/api/health");
	assert.equal(res.status, 200);

	// Helmet security headers
	assert.equal(res.headers["x-content-type-options"], "nosniff");
	assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
	assert.equal(res.headers["x-dns-prefetch-control"], "off");
	assert.ok(res.headers["content-security-policy"], "CSP header should be present");
	assert.match(res.headers["content-security-policy"], /default-src 'self'/);
});

test("zod schema validation rejects invalid profile updates with 400", async () => {
	const res = await request(app)
		.post("/api/profile")
		.send({ focusAreas: "this should be an array" });

	assert.equal(res.status, 400);
	assert.equal(res.body.success, false);
	assert.ok(Array.isArray(res.body.errors));
	assert.ok(res.body.errors.some((e) => e.field === "focusAreas"));
});

test("zod schema validation rejects invalid task payloads with 400 and descriptive errors", async () => {
	// Missing title
	const missingTitle = await request(app)
		.post("/api/tasks")
		.send({ priority: "high" });

	assert.equal(missingTitle.status, 400);
	assert.ok(missingTitle.body.errors.some((e) => e.field === "title"));

	// Invalid priority enum
	const invalidPriority = await request(app)
		.post("/api/tasks")
		.send({ title: "Test task", priority: "critical" });

	assert.equal(invalidPriority.status, 400);
	assert.ok(invalidPriority.body.errors.some((e) => e.field === "priority"));
});

test("zod schema validation rejects reminders missing schedule times with 400", async () => {
	const res = await request(app)
		.post("/api/reminders")
		.send({ title: "Check logs" }); // Missing when / time

	assert.equal(res.status, 400);
	assert.match(res.body.message, /scheduled time/i);
});

test("zod schema validation rejects empty chat messages with 400", async () => {
	const res = await request(app)
		.post("/api/ai/chat")
		.send({ message: "   " }); // whitespace only

	assert.equal(res.status, 400);
	assert.match(res.body.message, /Message cannot be empty/i);
});

test("zod schema validation rejects malformed login credentials with 400", async () => {
	const res = await request(app)
		.post("/api/auth/login")
		.send({ email: "invalid-email-format", password: "short" });

	assert.equal(res.status, 400);
	assert.ok(res.body.errors.length >= 1);
});

test("auth rate limiter restricts /api/auth/login to max attempts per IP with 429", async () => {
	const targetIp = "203.0.113.88";
	const attempts = 5;

	// Exhaust the allowed attempts
	for (let i = 0; i < attempts; i++) {
		const res = await request(app)
			.post("/api/auth/login")
			.set("X-Forwarded-For", targetIp)
			.send({ email: "attacker@example.com", password: "wrong-password-here" });

		// Should fail authentication with 401, not 429 yet
		assert.equal(res.status, 401, `Attempt ${i + 1} should be authenticated (401)`);
	}

	// 6th attempt should be rejected by the rate limiter
	const blockedRes = await request(app)
		.post("/api/auth/login")
		.set("X-Forwarded-For", targetIp)
		.send({ email: "attacker@example.com", password: "wrong-password-here" });

	assert.equal(blockedRes.status, 429, "6th attempt from the same IP must be rate-limited (429)");
	assert.match(blockedRes.body.message, /too many login attempts/i);

	// A different IP should still be allowed through
	const freshIpRes = await request(app)
		.post("/api/auth/login")
		.set("X-Forwarded-For", "203.0.113.89")
		.send({ email: "attacker@example.com", password: "wrong-password-here" });

	assert.equal(freshIpRes.status, 401, "Different IP should not be blocked by target IP's limit");
});
