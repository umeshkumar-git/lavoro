const { z } = require("zod");

const loginSchema = z.object({
	email: z.string().trim().email("A valid email is required."),
	password: z.string().min(8, "Password must be at least 8 characters long."),
});

const refreshTokenSchema = z.object({
	refreshToken: z.string().min(10, "Refresh token is required."),
});

const jobSchema = z.object({
	type: z.enum(["daily-summary", "email-digest", "report-generation"]),
	payload: z.record(z.any()).default({}),
});

const profileSchema = z.object({
	name: z.string().trim().max(200, "Name must be under 200 characters.").optional(),
	role: z.string().trim().max(200, "Role must be under 200 characters.").optional(),
	timezone: z.string().trim().max(200, "Timezone must be under 200 characters.").optional(),
	workingHours: z.string().trim().max(200, "Working hours must be under 200 characters.").optional(),
	goal: z.string().trim().max(200, "Goal must be under 200 characters.").optional(),
	preferredSummaryStyle: z.string().trim().max(200, "Summary style must be under 200 characters.").optional(),
	focusAreas: z
		.array(z.string().trim().max(80, "Each focus area must be under 80 characters."))
		.max(20, "At most 20 focus areas allowed.")
		.optional(),
}).strip();

const taskCreateSchema = z.object({
	title: z
		.string({ required_error: "Task title is required.", invalid_type_error: "Task title is required." })
		.trim()
		.min(1, "Task title is required.")
		.max(200, "Task title must be under 200 characters."),
	priority: z.enum(["high", "medium", "low"]).default("medium"),
	due: z.string().trim().max(100).default("today"),
	category: z.string().trim().max(100).optional(),
	status: z.enum(["todo", "in-progress", "done"]).default("todo"),
});

const reminderCreateSchema = z
	.object({
		title: z.string().trim().min(1, "Reminder title is required.").max(200, "Reminder title must be under 200 characters."),
		when: z.string().trim().max(100).optional(),
		time: z.string().trim().max(100).optional(),
	})
	.refine((data) => Boolean(data.when || data.time), {
		message: "A scheduled time (when or time) is required.",
	});

const planCreateSchema = z.object({
	prompt: z.string().trim().max(500, "Prompt must be under 500 characters.").default(""),
});

const chatMessageSchema = z.object({
	message: z.string().trim().min(1, "Message cannot be empty.").max(4000, "Message must be under 4000 characters."),
	mode: z.enum(["assistant", "briefing", "planner", "tasks", "email", "summary"]).optional(),
	sessionId: z.string().trim().max(100).optional(),
});

const dailySummarySchema = z.object({
	tasks: z.array(z.any()).default([]),
	notes: z.array(z.string()).default([]),
	goals: z.array(z.string()).default([]),
});

module.exports = {
	loginSchema,
	refreshTokenSchema,
	jobSchema,
	profileSchema,
	taskCreateSchema,
	reminderCreateSchema,
	planCreateSchema,
	chatMessageSchema,
	dailySummarySchema,
};
