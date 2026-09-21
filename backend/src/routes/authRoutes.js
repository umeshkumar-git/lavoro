const express = require("express");
const { loginSchema, refreshTokenSchema } = require("../shared/schemas");
const { validateBody } = require("../middleware/validation");
const { authRateLimiter } = require("../middleware/rateLimit");
const { authenticate } = require("../middleware/auth");
const { loginUser, rotateRefreshToken, getUserFromToken } = require("../services/authService");

const router = express.Router();

router.post("/login", authRateLimiter, validateBody(loginSchema), async (req, res) => {
	try {
		const payload = await loginUser(req.body);
		return res.json({ success: true, ...payload });
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Unable to log in.",
		});
	}
});

router.post("/refresh", validateBody(refreshTokenSchema), (req, res) => {
	try {
		const tokens = rotateRefreshToken(req.body.refreshToken);
		return res.json({ success: true, tokens });
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Unable to refresh session.",
		});
	}
});

router.get("/me", authenticate, (req, res) => {
	const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
	const user = getUserFromToken(token);
	if (!user) {
		return res.status(401).json({
			success: false,
			message: "Authenticated user could not be resolved.",
		});
	}

	return res.json({
		success: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		},
	});
});

module.exports = router;
