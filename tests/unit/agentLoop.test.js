const { test } = require("node:test");
const assert = require("node:assert/strict");

const { executeTool, TOOL_DECLARATIONS, formatToolMessage } = require("../../backend/src/ai/tools");
const { AIOrchestrator } = require("../../backend/src/ai/orchestrator");
const { DemoProvider, detectToolIntent } = require("../../backend/src/ai/providers");
const { getTasks, getReminders } = require("../../backend/src/data/store");

test("TOOL_DECLARATIONS defines JSON Schema tools conforming to function calling standards", () => {
	const toolNames = TOOL_DECLARATIONS.map((t) => t.name);
	const expectedTools = [
		"createTask",
		"addReminder",
		"createDailyPlan",
		"searchProject",
		"queryDocuments",
		"getWorkspaceSummary",
	];

	for (const expected of expectedTools) {
		assert.ok(toolNames.includes(expected), `Tool '${expected}' must be declared`);
	}

	for (const tool of TOOL_DECLARATIONS) {
		assert.ok(tool.name);
		assert.ok(tool.description);
		assert.ok(tool.parameters);
		assert.equal(tool.parameters.type, "object");
	}
});

test("executeTool dispatches safely to domain operations and handles errors gracefully", async () => {
	const sessionId = "unit-test-agent-session";

	// 1. createTask
	const taskResult = await executeTool("createTask", {
		title: "Ship Phase 5 unit tests",
		priority: "high",
		category: "testing",
	}, { sessionId });
	assert.equal(taskResult.success, true);
	assert.equal(taskResult.tool, "createTask");
	assert.ok(taskResult.result);
	const tasks = getTasks(sessionId);
	assert.ok(tasks.some((t) => t.title === "Ship Phase 5 unit tests"));

	// 2. addReminder
	const reminderResult = await executeTool("addReminder", {
		title: "Verify test coverage report",
		time: "today 19:00",
	}, { sessionId });
	assert.equal(reminderResult.success, true);
	assert.equal(reminderResult.tool, "addReminder");
	const reminders = getReminders(sessionId);
	assert.ok(reminders.some((r) => r.title === "Verify test coverage report"));

	// 3. getWorkspaceSummary
	const summaryResult = await executeTool("getWorkspaceSummary", {}, { sessionId });
	assert.equal(summaryResult.success, true);
	assert.ok(summaryResult.result.activeTasks.length > 0);

	// 4. Unknown tool handling
	const unknownResult = await executeTool("nonExistentTool", {}, { sessionId });
	assert.equal(unknownResult.success, false);
	assert.match(unknownResult.error, /Unknown tool/);
});

test("formatToolMessage generates human-friendly action summaries", () => {
	const msg1 = formatToolMessage("createTask", {
		success: true,
		message: 'Created task: "Draft memo" with high priority.',
	});
	assert.match(msg1, /Created task: "Draft memo"/);

	const msg2 = formatToolMessage("addReminder", {
		success: true,
		message: 'Scheduled reminder: "Daily standup" for 09:00.',
	});
	assert.match(msg2, /Scheduled reminder: "Daily standup"/);

	const msg3 = formatToolMessage("randomTool", { success: true, message: "Action done" });
	assert.equal(msg3, "Action done");
});

test("AIOrchestrator generates response and executes tool calls via agent loop", async () => {
	const orchestrator = new AIOrchestrator();
	const sessionId = "orchestrator-test-session";

	const response = await orchestrator.generate({
		message: "Add a high priority task to review Q4 budget",
		sessionId,
	});

	assert.ok(response.message, "response message should be populated");
	assert.ok(Array.isArray(response.tools), "tools array should be included");
	assert.ok(response.tools.length > 0, "createTask tool should be invoked");
	assert.equal(response.tools[0].tool, "createTask");
	assert.ok(response.tools[0].message);
});

test("AIOrchestrator stream yields tool events before text tokens", async () => {
	const orchestrator = new AIOrchestrator();
	const sessionId = "stream-test-session";

	const events = [];
	for await (const chunk of orchestrator.stream({
		message: "Remind me to call the architect at 5pm",
		sessionId,
	})) {
		events.push(chunk);
	}

	assert.ok(events.length > 0);
	const toolEvents = events.filter((e) => e.type === "tool");
	const chunkEvents = events.filter((e) => e.type === "chunk");

	assert.ok(toolEvents.length > 0, "stream should yield tool event");
	assert.equal(toolEvents[0].tool, "addReminder");
	assert.ok(chunkEvents.length > 0, "stream should yield text chunks");

	// First tool event should precede first chunk event
	const firstToolIndex = events.findIndex((e) => e.type === "tool");
	const firstChunkIndex = events.findIndex((e) => e.type === "chunk");
	assert.ok(firstToolIndex < firstChunkIndex, "tool event must be emitted before text chunks");
});

test("DemoProvider enforces maxIterations cap to prevent runaway loops", async () => {
	const provider = new DemoProvider();
	let iterations = 0;

	// Custom execute tool that keeps returning a trigger
	const loopingExecute = async () => {
		iterations++;
		return { success: true, loop: true };
	};

	const result = await provider.runAgentLoop({
		prompt: "Add a task to check loop limits",
		sessionId: "cap-test-session",
		maxIterations: 3,
		executeTool: loopingExecute,
	});

	assert.ok(result);
	assert.ok(iterations <= 3, `iterations (${iterations}) should not exceed maxIterations (3)`);
});

test("detectToolIntent parses natural language queries into correct tool calls", () => {
	const reminder = detectToolIntent("Remind me tomorrow at 4pm to call the dentist");
	assert.equal(reminder?.name, "addReminder");
	assert.equal(reminder?.args?.title, "call the dentist");

	const plan = detectToolIntent("Plan my day with deep work blocks");
	assert.equal(plan?.name, "createDailyPlan");

	const search = detectToolIntent("Search the codebase for authService");
	assert.equal(search?.name, "searchProject");
	assert.match(search?.args?.query, /authService/);

	const rag = detectToolIntent("Search documents for quarterly review");
	assert.equal(rag?.name, "queryDocuments");
	assert.match(rag?.args?.query, /quarterly review/);

	const none = detectToolIntent("What is the capital of Italy?");
	assert.equal(none, null);
});

test("DemoProvider produces tailored responses for each productivity mode", async () => {
	const provider = new DemoProvider();
	const modes = ["briefing", "planner", "tasks", "email", "summary", "assistant"];

	for (const mode of modes) {
		const res = await provider.runAgentLoop({
			prompt: "General check-in",
			metadata: { mode },
			executeTool: async () => ({ success: true }),
		});
		assert.ok(res.text.length > 20, `mode ${mode} should return meaningful text`);
	}
});
