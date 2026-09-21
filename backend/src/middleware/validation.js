function validateBody(schema) {
	return (req, res, next) => {
		const result = schema.safeParse(req.body || {});
		if (!result.success) {
			const firstIssue = result.error.issues[0];
			const message = firstIssue?.message || "Invalid request payload.";
			return res.status(400).json({
				success: false,
				message,
				errors: result.error.issues.map((issue) => ({
					field: issue.path.join("."),
					message: issue.message,
				})),
			});
		}

		req.body = result.data;
		return next();
	};
}

module.exports = {
	validateBody,
};
