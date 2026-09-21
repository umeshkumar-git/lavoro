const path = require("path");

function requireJwtSecret() {
	const secret = process.env.JWT_SECRET;
	if (secret) return secret;

	if (process.env.NODE_ENV === "production") {
		throw new Error("JWT_SECRET must be set in production.");
	}

	console.warn(
		"⚠️  JWT_SECRET not set — using an insecure dev-only fallback.",
	);
	return "lavoro-dev-secret-DO-NOT-USE-IN-PROD";
}

const config = {
	appName: "Lavoro: Personal Daily Assistant",
	port: Number(process.env.PORT || 10000),
	projectRoot: path.resolve(__dirname, "../../.."),
	frontendDir: path.resolve(__dirname, "../../../frontend"),
	jwt: {
		secret: requireJwtSecret(),
		accessTtl: process.env.JWT_ACCESS_TTL || "15m",
		refreshTtl: process.env.JWT_REFRESH_TTL || "7d",
	},
	redis: {
		url: process.env.REDIS_URL || "redis://localhost:6379",
	},
	db: {
		url: process.env.DATABASE_URL || "",
		path: process.env.SQLITE_PATH || "",
	},
	allowedOrigins: new Set([
		"https://lavoro.umeshshah.in",
		"https://umeshshah.in",
		"https://www.umeshshah.in",
		"https://api.lavoro.umeshshah.in",
	]),
};

module.exports = config;
