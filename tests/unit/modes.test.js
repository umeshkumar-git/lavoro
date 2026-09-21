const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
	AI_MODES,
	DEFAULT_MODE,
	detectMode,
	normalizeMode,
} = require("../../backend/src/ai/modes");

test("AI_MODES defines all 6 productivity modes with required metadata", () => {
	const expectedModes = ["assistant", "briefing", "planner", "tasks", "email", "summary"];

	for (const mode of expectedModes) {
		assert.ok(AI_MODES[mode], `Mode '${mode}' should be defined in AI_MODES`);
		assert.ok(AI_MODES[mode].label, `Mode '${mode}' must have a label`);
		assert.ok(AI_MODES[mode].description, `Mode '${mode}' must have a description`);
		assert.ok(Array.isArray(AI_MODES[mode].keywords), `Mode '${mode}' must have keywords array`);
		assert.ok(AI_MODES[mode].responseGuide, `Mode '${mode}' must have a responseGuide`);
	}
});

test("detectMode accurately routes messages to the expected productivity mode", () => {
	// Briefing mode
	assert.equal(detectMode("Can you give me my morning briefing?"), "briefing");
	assert.equal(detectMode("What is my agenda for today?"), "briefing");
	assert.equal(detectMode("Let's start my day with a quick overview"), "briefing");

	// Planner mode
	assert.equal(detectMode("Plan my day with 2-hour focus blocks"), "planner");
	assert.equal(detectMode("How should I time block my afternoon calendar?"), "planner");
	assert.equal(detectMode("Schedule a deep work block before meetings"), "planner");

	// Tasks mode
	assert.equal(detectMode("Prioritize my tasks using the Eisenhower matrix"), "tasks");
	assert.equal(detectMode("What urgent action items are pending?"), "tasks");
	assert.equal(detectMode("Put this on my to-do list"), "tasks");

	// Email mode
	assert.equal(detectMode("Triage my inbox for unread messages"), "email");
	assert.equal(detectMode("Help me draft reply to this sender"), "email");
	assert.equal(detectMode("Do I have any unread emails from clients?"), "email");

	// Summary mode
	assert.equal(detectMode("Generate my daily summary and retrospective"), "summary");
	assert.equal(detectMode("Wrap up my day and calculate my productivity score"), "summary");
	assert.equal(detectMode("What were my key achievements at end of day?"), "summary");

	// Default fallback to assistant
	assert.equal(detectMode("What is the capital of Italy?"), DEFAULT_MODE);
	assert.equal(detectMode(""), DEFAULT_MODE);
	assert.equal(detectMode(null), DEFAULT_MODE);
});

test("detectMode respects explicit requestedMode overrides", () => {
	// Even if message matches 'email', explicit mode takes precedence
	assert.equal(
		detectMode("Check my emails and triage inbox", "planner"),
		"planner",
		"explicit mode should override keyword detection",
	);

	// 'auto' should trigger keyword detection
	assert.equal(
		detectMode("Give me my morning briefing", "auto"),
		"briefing",
		"'auto' mode should defer to keyword detection",
	);

	// Invalid requested mode falls back to default
	assert.equal(
		detectMode("Random query", "non-existent-mode"),
		DEFAULT_MODE,
		"invalid requested mode should fall back to default",
	);
});

test("normalizeMode handles valid and invalid mode inputs cleanly", () => {
	assert.equal(normalizeMode("assistant"), "assistant");
	assert.equal(normalizeMode("briefing"), "briefing");
	assert.equal(normalizeMode("planner"), "planner");
	assert.equal(normalizeMode("tasks"), "tasks");
	assert.equal(normalizeMode("email"), "email");
	assert.equal(normalizeMode("summary"), "summary");

	assert.equal(normalizeMode("invalid"), DEFAULT_MODE);
	assert.equal(normalizeMode(""), DEFAULT_MODE);
	assert.equal(normalizeMode(null), DEFAULT_MODE);
	assert.equal(normalizeMode(undefined), DEFAULT_MODE);
	assert.equal(normalizeMode(123), DEFAULT_MODE);
});
