const memoryCache = new Map();

async function get(key) {
	const value = memoryCache.get(key);
	if (value === undefined) return null;

	if (value.expiresAt && value.expiresAt <= Date.now()) {
		memoryCache.delete(key);
		return null;
	}

	return value.payload;
}

async function set(key, value, ttlSeconds = 300) {
	memoryCache.set(key, {
		payload: value,
		expiresAt: Date.now() + ttlSeconds * 1000,
	});
	return value;
}

async function del(key) {
	memoryCache.delete(key);
	return true;
}

module.exports = {
	get,
	set,
	del,
	memoryCache,
};
