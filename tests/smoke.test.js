const test = require("node:test");
const assert = require("node:assert/strict");

const APP_URL = process.env.APP_URL || "http://localhost:10000";

test("health endpoint is available and reports healthy status", async () => {
	const response = await fetch(`${APP_URL}/api/health`);
	assert.equal(response.status, 200, "health endpoint should return 200");

	const payload = await response.json();
	assert.equal(payload.status, "healthy", "status should be healthy");
	assert.equal(
		payload.service,
		"Developer Mentor AI",
		"service name should match the app",
	);
	assert.equal(
		payload.frontend,
		"vanilla-html-css-js",
		"frontend should be the static app shell",
	);
});

test("homepage serves the app shell with the premium dashboard HTML", async () => {
	const response = await fetch(APP_URL);
	assert.equal(response.status, 200, "homepage should return 200");

	const html = await response.text();
	assert.match(
		html,
		/Developer Mentor AI/,
		"page should include the application title",
	);
	assert.match(
		html,
		/app-shell/,
		"page should render the app shell container",
	);
	assert.match(html, /chatMessages/, "chat container should be present");
});
