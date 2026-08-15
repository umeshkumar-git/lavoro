function createRateLimiter({ windowMs = 60_000, max = 40 } = {}) {
	const buckets = new Map();

	return function rateLimiter(req, res, next) {
		const key = req.ip || "unknown";
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
				message: "Too many requests. Please slow down and try again shortly.",
			});
		}

		return next();
	};
}

module.exports = {
	createRateLimiter,
};
