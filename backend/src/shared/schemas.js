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

module.exports = {
	loginSchema,
	refreshTokenSchema,
	jobSchema,
};
