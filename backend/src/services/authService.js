const jwt = require("jsonwebtoken");
const config = require("../config");
const { findByEmail, findById } = require("../repositories/userRepository");

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
		{ ...payload, type: "refresh" },
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

function loginUser({ email, password }) {
	const user = findByEmail(email);
	if (!user || user.password !== password) {
		throw Object.assign(new Error("Invalid email or password."), {
			statusCode: 401,
		});
	}

	const tokens = generateTokenPair(user);
	refreshTokens.set(tokens.refreshToken, {
		userId: user.id,
		issuedAt: Date.now(),
	});

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

	const storedToken = refreshTokens.get(refreshToken);
	if (!storedToken || storedToken.userId !== payload.sub) {
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
	refreshTokens.delete(refreshToken);
	refreshTokens.set(nextPair.refreshToken, {
		userId: user.id,
		issuedAt: Date.now(),
	});

	return nextPair;
}

function getUserFromToken(token) {
	const payload = verifyToken(token);
	return findById(payload.sub);
}

module.exports = {
	getUserFromToken,
	loginUser,
	refreshTokens,
	rotateRefreshToken,
	verifyToken,
};
