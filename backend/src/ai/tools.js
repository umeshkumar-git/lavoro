const {
	addTask,
	addReminder,
	createDailyPlan,
	getTasks,
	getReminders,
	getPlans,
} = require("../data/store");
const { searchProject } = require("../utils/projectScanner");
const { queryDocuments } = require("../services/ragService");

const TOOL_DECLARATIONS = [
	{
		name: "createTask",
		description:
			"Creates a new task or to-do item in the user's workspace with priority and due date.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "The action title or description of the task.",
				},
				priority: {
					type: "string",
					description: "Task priority level: high, medium, or low.",
					enum: ["high", "medium", "low"],
				},
				due: {
					type: "string",
					description:
						"When the task is due (e.g., 'today', 'tomorrow', 'Friday').",
				},
				category: {
					type: "string",
					description:
						"Category of the task (e.g., 'planning', 'deliverable', 'meeting', 'review').",
				},
			},
			required: ["title"],
		},
	},
	{
		name: "addReminder",
		description:
			"Sets a scheduled reminder or alert for the user at a specified time.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "The reminder text or action to be remembered.",
				},
				when: {
					type: "string",
					description:
						"When the reminder should trigger (e.g., 'today 18:00', 'tomorrow 09:00', '3pm').",
				},
			},
			required: ["title"],
		},
	},
	{
		name: "createDailyPlan",
		description:
			"Generates a structured, time-blocked daily plan based on the user's active tasks, calendar events, and goals.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"Specific focus, priorities, or instructions for the plan.",
				},
			},
		},
	},
	{
		name: "searchProject",
		description:
			"Searches the local project workspace and source code for keywords, filenames, or functions.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Keywords or code patterns to search for.",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "queryDocuments",
		description:
			"Searches the indexed knowledge base and notes (RAG) for relevant documents and historical context.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The search query to match against indexed documents.",
				},
				limit: {
					type: "integer",
					description: "Maximum number of relevant documents to return (default: 5).",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "getWorkspaceSummary",
		description:
			"Retrieves current active tasks, upcoming reminders, and recent daily plans from the user's workspace.",
		parameters: {
			type: "object",
			properties: {},
		},
	},
];

/**
 * Executes a tool call safely against the workspace context.
 */
async function executeTool(name, args = {}, context = {}) {
	const sessionId = context.sessionId || "default-session";
	const projectRoot = context.projectRoot || process.cwd();

	try {
		switch (name) {
			case "createTask": {
				const title = String(args.title || "").trim();
				if (!title) throw new Error("Task title is required.");
				const tasks = addTask(sessionId, {
					title,
					priority: args.priority || "medium",
					due: args.due || "today",
					category: args.category || "general",
				});
				const created = tasks[0];
				return {
					success: true,
					tool: name,
					message: `Task added: "${created.title}" [Priority: ${created.priority}]`,
					result: created,
				};
			}

			case "addReminder": {
				const title = String(args.title || "").trim();
				if (!title) throw new Error("Reminder title is required.");
				const reminders = addReminder(sessionId, {
					title,
					when: args.when || "today 18:00",
				});
				const created = reminders[0];
				return {
					success: true,
					tool: name,
					message: `Reminder set: "${created.title}" for ${created.when}`,
					result: created,
				};
			}

			case "createDailyPlan": {
				const plan = createDailyPlan(sessionId, args.prompt || "");
				return {
					success: true,
					tool: name,
					message: `Daily plan created: ${plan.summary}`,
					result: plan,
				};
			}

			case "searchProject": {
				const query = String(args.query || "").trim();
				if (!query) throw new Error("Search query is required.");
				const matches = await searchProject(projectRoot, query);
				return {
					success: true,
					tool: name,
					message: `Found ${matches.length} matches for "${query}".`,
					result: matches.slice(0, 15),
				};
			}

			case "queryDocuments": {
				const query = String(args.query || "").trim();
				if (!query) throw new Error("Query is required.");
				const results = await queryDocuments(query, Number(args.limit) || 5);
				return {
					success: true,
					tool: name,
					message: `Retrieved ${results.length} relevant documents.`,
					result: results,
				};
			}

			case "getWorkspaceSummary": {
				const tasks = getTasks(sessionId).filter((t) => t.status !== "done");
				const reminders = getReminders(sessionId).filter((r) => !r.done);
				const plans = getPlans(sessionId);
				return {
					success: true,
					tool: name,
					message: `Workspace contains ${tasks.length} active tasks and ${reminders.length} reminders.`,
					result: {
						activeTasks: tasks.slice(0, 8),
						reminders: reminders.slice(0, 5),
						latestPlan: plans[0] || null,
					},
				};
			}

			default:
				return {
					success: false,
					tool: name,
					error: `Unknown tool: "${name}"`,
				};
		}
	} catch (error) {
		return {
			success: false,
			tool: name,
			error: error.message || "Tool execution failed.",
		};
	}
}

/**
 * Returns a human-friendly notification message for a tool execution.
 */
function formatToolMessage(name, result) {
	if (!result || !result.success) {
		return `⚠️ Tool ${name} failed: ${result?.error || "Unknown error"}`;
	}
	return result.message || `Executed tool ${name}.`;
}

module.exports = {
	TOOL_DECLARATIONS,
	executeTool,
	formatToolMessage,
};
