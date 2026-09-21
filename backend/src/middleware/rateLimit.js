function createRateLimiter({
	windowMs = 60_000,
	max = 40,
	message = "Too many requests. Please slow down and try again shortly.",
	keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || "unknown",
} = {}) {
	const buckets = new Map();

	return function rateLimiter(req, res, next) {
		const key = keyGenerator(req);
		const now = Date.now();
		const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

		if (now > bucket.resetAt) {
			bucket.count = 0;
			bucket.resetAt = now + windowMs;
		}

		bucket.count += 1;
		buckets.set(key, bucket);

		res.setHeader("X-RateLimit-Limit", max);
		res.setHeader("X-RateLimit-Remaining", Math.max(0, max - bucket.count));
		res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

		if (bucket.count > max) {
			return res.status(429).json({
				success: false,
				message,
			});
		}

		return next();
	};
}

const authRateLimiter = createRateLimiter({
	windowMs: 60_000,
	max: process.env.AUTH_RATE_LIMIT_MAX ? Number(process.env.AUTH_RATE_LIMIT_MAX) : 5,
	message: "Too many login attempts. Please wait a minute before trying again.",
});

module.exports = {
	createRateLimiter,
	authRateLimiter,
};
