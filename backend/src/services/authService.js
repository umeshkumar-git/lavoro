const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { getDb } = require("../db");
const { findByEmail, findById } = require("../repositories/userRepository");

/**
 * In-memory fallback map used only when DATABASE_URL is unset.
 */
const refreshTokens = new Map();

function generateTokenPair(user) {
	const payload = {
		sub: user.id,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwt.sign(payload, config.jwt.secret, {
		expiresIn: config.jwt.accessTtl,
	});
	const refreshToken = jwt.sign(
		{ ...payload, type: "refresh", jti: randomUUID() },
		config.jwt.secret,
		{ expiresIn: config.jwt.refreshTtl },
	);

	return { accessToken, refreshToken };
}

function verifyToken(token) {
	if (!token) {
		throw Object.assign(new Error("Authentication token is required."), {
			statusCode: 401,
		});
	}

	try {
		return jwt.verify(token, config.jwt.secret);
	} catch (error) {
		throw Object.assign(new Error("Invalid or expired token."), {
			statusCode: 401,
		});
	}
}

async function loginUser({ email, password }) {
	const user = findByEmail(email);
	if (!user) {
		throw Object.assign(new Error("Invalid email or password."), {
			statusCode: 401,
		});
	}

	const passwordMatches = await bcrypt.compare(password, user.password);
	if (!passwordMatches) {
		throw Object.assign(new Error("Invalid email or password."), {
			statusCode: 401,
		});
	}

	const tokens = generateTokenPair(user);
	const db = getDb();

	if (db) {
		db.prepare(`
			INSERT OR REPLACE INTO refresh_tokens (token, user_id, issued_at, expires_at)
			VALUES (?, ?, ?, ?)
		`).run(tokens.refreshToken, user.id, Date.now(), null);
	} else {
		refreshTokens.set(tokens.refreshToken, {
			userId: user.id,
			issuedAt: Date.now(),
		});
	}

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		},
		tokens,
	};
}

function rotateRefreshToken(refreshToken) {
	const payload = verifyToken(refreshToken);
	if (payload.type !== "refresh") {
		throw Object.assign(new Error("Invalid refresh token type."), {
			statusCode: 401,
		});
	}

	const db = getDb();
	let tokenValid = false;

	if (db) {
		const row = db
			.prepare("SELECT * FROM refresh_tokens WHERE token = ?")
			.get(refreshToken);
		if (row && row.user_id === payload.sub) {
			tokenValid = true;
		}
	} else {
		const storedToken = refreshTokens.get(refreshToken);
		if (storedToken && storedToken.userId === payload.sub) {
			tokenValid = true;
		}
	}

	if (!tokenValid) {
		throw Object.assign(new Error("Refresh token is not recognized."), {
			statusCode: 401,
		});
	}

	const user = findById(payload.sub);
	if (!user) {
		throw Object.assign(new Error("User no longer exists."), {
			statusCode: 401,
		});
	}

	const nextPair = generateTokenPair(user);

	if (db) {
		const rotateTx = db.transaction(() => {
			db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken);
			db.prepare(`
				INSERT INTO refresh_tokens (token, user_id, issued_at, expires_at)
				VALUES (?, ?, ?, ?)
			`).run(nextPair.refreshToken, user.id, Date.now(), null);
		});
		rotateTx();
	} else {
		refreshTokens.delete(refreshToken);
		refreshTokens.set(nextPair.refreshToken, {
			userId: user.id,
			issuedAt: Date.now(),
		});
	}

	return nextPair;
}

function getUserFromToken(token) {
	const payload = verifyToken(token);
	return findById(payload.sub);
}

function clearRefreshTokens() {
	const db = getDb();
	if (db) {
		db.prepare("DELETE FROM refresh_tokens").run();
	}
	refreshTokens.clear();
}

module.exports = {
	clearRefreshTokens,
	getUserFromToken,
	loginUser,
	refreshTokens,
	rotateRefreshToken,
	verifyToken,
};
