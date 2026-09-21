const fs = require("fs");
const path = require("path");
const { AIOrchestrator } = require("../backend/src/ai/orchestrator");
const { DemoProvider, GeminiProvider } = require("../backend/src/ai/providers");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const EVAL_CASES = [
	{
		id: "TC-01",
		category: "Task Management",
		prompt: "Add a task to review the Q4 financial report tomorrow",
		expectedTool: "createTask",
	},
	{
		id: "TC-02",
		category: "Task Management",
		prompt: "Create a task: Refactor dashboard CSS with high priority",
		expectedTool: "createTask",
	},
	{
		id: "TC-03",
		category: "Task Management",
		prompt: "Add to-do: Update dependencies in package.json",
		expectedTool: "createTask",
	},
	{
		id: "TC-04",
		category: "Task Management",
		prompt: "Put 'Deploy to staging' on my task list with high priority",
		expectedTool: "createTask",
	},
	{
		id: "TC-05",
		category: "Reminders",
		prompt: "Remind me to take medication at 8 PM tonight",
		expectedTool: "addReminder",
	},
	{
		id: "TC-06",
		category: "Reminders",
		prompt: "Set a reminder for the design sync at 3pm",
		expectedTool: "addReminder",
	},
	{
		id: "TC-07",
		category: "Reminders",
		prompt: "Remind me tomorrow at 9am to check unread email",
		expectedTool: "addReminder",
	},
	{
		id: "TC-08",
		category: "Reminders",
		prompt: "Don't let me forget to call mom at 6pm",
		expectedTool: "addReminder",
	},
	{
		id: "TC-09",
		category: "Day Planning",
		prompt: "Plan my day around my meetings and high priority tasks",
		expectedTool: "createDailyPlan",
	},
	{
		id: "TC-10",
		category: "Day Planning",
		prompt: "Build a schedule for my afternoon focus block",
		expectedTool: "createDailyPlan",
	},
	{
		id: "TC-11",
		category: "Day Planning",
		prompt: "Create a daily plan for tomorrow morning",
		expectedTool: "createDailyPlan",
	},
	{
		id: "TC-12",
		category: "Codebase Search",
		prompt: "Search the codebase for authentication middleware",
		expectedTool: "searchProject",
	},
	{
		id: "TC-13",
		category: "Codebase Search",
		prompt: "Find references to Redis in our repository",
		expectedTool: "searchProject",
	},
	{
		id: "TC-14",
		category: "Knowledge Retrieval",
		prompt: "Find any documents about our cloud deployment architecture",
		expectedTool: "queryDocuments",
	},
	{
		id: "TC-15",
		category: "Knowledge Retrieval",
		prompt: "Search our knowledge base for project onboarding notes",
		expectedTool: "queryDocuments",
	},
	{
		id: "TC-16",
		category: "Conversational",
		prompt: "What is the capital of Italy?",
		expectedTool: "none",
	},
	{
		id: "TC-17",
		category: "Conversational",
		prompt: "Can you explain what the Eisenhower Matrix is?",
		expectedTool: "none",
	},
	{
		id: "TC-18",
		category: "Conversational",
		prompt: "Write a polite email asking a colleague for project status",
		expectedTool: "none",
	},
];

async function runEvaluations() {
	console.log("=================================================");
	console.log("  Lavoro AI Agent - Evaluation Benchmark Runner  ");
	console.log("=================================================\n");

	const primaryProvider = new GeminiProvider({
		apiKey: process.env.GEMINI_API_KEY,
		modelNames: ["gemini-3-flash-preview", "gemini-1.5-flash"],
		GoogleGenerativeAI,
	});
	const fallbackProvider = new DemoProvider();
	const ai = new AIOrchestrator({
		primaryProvider,
		fallbackProvider,
		getProjectStructure: async () => ({ summary: "Project files", files: [] }),
	});

	const isLiveModel = primaryProvider.isConfigured();
	console.log(`Execution Mode: ${isLiveModel ? "Live Gemini Model" : "Deterministic Demo Provider"}`);
	console.log(`Evaluating ${EVAL_CASES.length} benchmark test cases...\n`);

	const results = [];
	let passed = 0;

	for (const testCase of EVAL_CASES) {
		const startTime = Date.now();
		const response = await ai.generate({
			message: testCase.prompt,
			sessionId: `eval-${testCase.id}`,
		});
		const durationMs = Date.now() - startTime;

		const predictedTool =
			response.tools && response.tools.length > 0
				? response.tools[0].tool
				: "none";

		const isCorrect = predictedTool === testCase.expectedTool;
		if (isCorrect) passed++;

		results.push({
			...testCase,
			predictedTool,
			isCorrect,
			durationMs,
		});

		console.log(
			`[${testCase.id}] ${isCorrect ? "✅ PASS" : "❌ FAIL"} - Expected: ${testCase.expectedTool} | Got: ${predictedTool} ("${testCase.prompt.slice(0, 45)}...")`,
		);
	}

	const accuracy = ((passed / EVAL_CASES.length) * 100).toFixed(1);
	console.log("\n-------------------------------------------------");
	console.log(`Evaluation Completed: ${passed}/${EVAL_CASES.length} Passed (${accuracy}% Accuracy)`);
	console.log("-------------------------------------------------\n");

	generateEvalsMarkdown(results, accuracy, isLiveModel);
	return { passed, total: EVAL_CASES.length, accuracy };
}

function generateEvalsMarkdown(results, accuracy, isLiveModel) {
	const evalDate = new Date().toISOString().split("T")[0];
	const rows = results
		.map(
			(r) =>
				`| ${r.id} | ${r.category} | "${r.prompt.replace(/\|/g, "\\|")}" | \`${r.expectedTool}\` | \`${r.predictedTool}\` | ${r.isCorrect ? "✅ PASS" : "❌ FAIL"} | ${r.durationMs}ms |`,
		)
		.join("\n");

	const content = `# Lavoro Agent Evaluation Benchmark (EVALS.md)

This document records the automated, deterministic evaluation benchmark for Lavoro's AI agent loop.

## Benchmark Summary
- **Execution Date**: ${evalDate}
- **Provider Evaluated**: ${isLiveModel ? "Google Gemini API (`gemini-3-flash-preview`)" : "Deterministic Provider (`DemoProvider`)"}
- **Total Test Cases**: ${results.length}
- **Passed**: ${results.filter((r) => r.isCorrect).length}
- **Failed**: ${results.filter((r) => !r.isCorrect).length}
- **Accuracy**: **${accuracy}%**

## Methodology
The evaluation evaluates the agent's ability to:
1. **Plan & Select Tools**: Accurately predict whether an incoming user prompt requires tool invocation (\`createTask\`, \`addReminder\`, \`createDailyPlan\`, \`searchProject\`, \`queryDocuments\`) or pure conversational response (\`none\`).
2. **Avoid False Positives**: Not triggering mutations on general queries, knowledge inquiries, or drafting requests.
3. **Execute Deterministically**: Execute the agent loop end-to-end within standard response time limits.

---

## Detailed Results Table

| ID | Category | Prompt | Expected Tool | Predicted Tool | Status | Latency |
|:---|:---|:---|:---|:---|:---:|:---|
${rows}

---

## Category Breakdown
- **Task Management**: ${getCategoryStats(results, "Task Management")}
- **Reminders**: ${getCategoryStats(results, "Reminders")}
- **Day Planning**: ${getCategoryStats(results, "Day Planning")}
- **Codebase Search**: ${getCategoryStats(results, "Codebase Search")}
- **Knowledge Retrieval**: ${getCategoryStats(results, "Knowledge Retrieval")}
- **Conversational (No Tool)**: ${getCategoryStats(results, "Conversational")}

---

## Running the Benchmark
To re-run the evaluations and regenerate this report:
\`\`\`bash
npm run eval
\`\`\`
`;

	const evalsPath = path.resolve(__dirname, "../EVALS.md");
	fs.writeFileSync(evalsPath, content, "utf8");
	console.log(`Saved benchmark report to ${evalsPath}`);
}

function getCategoryStats(results, category) {
	const catResults = results.filter((r) => r.category === category);
	const catPassed = catResults.filter((r) => r.isCorrect).length;
	const pct = ((catPassed / catResults.length) * 100).toFixed(0);
	return `${catPassed}/${catResults.length} (${pct}%)`;
}

if (require.main === module) {
	runEvaluations()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("Evaluation run failed:", err);
			process.exit(1);
		});
}

module.exports = {
	runEvaluations,
	EVAL_CASES,
};
