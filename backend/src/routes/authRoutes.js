const express = require("express");
const { loginSchema, refreshTokenSchema } = require("../shared/schemas");
const { authenticate } = require("../middleware/auth");
const { loginUser, rotateRefreshToken, getUserFromToken } = require("../services/authService");

const router = express.Router();

router.post("/login", async (req, res) => {
	const validation = loginSchema.safeParse(req.body || {});
	if (!validation.success) {
		return res.status(400).json({
			success: false,
			message: validation.error.issues[0]?.message || "Invalid login payload.",
		});
	}

	try {
		const payload = await loginUser(validation.data);
		return res.json({ success: true, ...payload });
	} catch (error) {
		return res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Unable to log in.",
		});
	}
});

router.post("/refresh", (req, res) => {
	const validation = refreshTokenSchema.safeParse(req.body || {});
	if (!validation.success) {
		return res.status(400).json({
			success: false,
			message: validation.error.issues[0]?.message || "Refresh token is required.",
		});
	}

	try {
		const tokens = rotateRefreshToken(validation.data.refreshToken);
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
