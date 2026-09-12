const { verifyToken } = require("../services/authService");
const { USER_ROLES } = require("../shared/constants");

function authenticate(req, res, next) {
	const header = req.headers.authorization || "";
	const token = header.startsWith("Bearer ") ? header.slice(7) : null;

	if (!token) {
		return res.status(401).json({
			success: false,
			message: "Authentication required.",
		});
	}

	try {
		const payload = verifyToken(token);
		req.user = {
			id: payload.sub,
			email: payload.email,
			role: payload.role || USER_ROLES.USER,
		};
		return next();
	} catch (error) {
		return res.status(error.statusCode || 401).json({
			success: false,
			message: error.message || "Invalid authentication token.",
		});
	}
}

function requireRole(...roles) {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "Authentication required.",
			});
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				message: "You do not have sufficient permissions for this action.",
			});
		}

		return next();
	};
}

module.exports = {
	authenticate,
	requireRole,
};
