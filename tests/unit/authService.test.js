const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("../../backend/node_modules/jsonwebtoken");

const config = require("../../backend/src/config");
const {
	clearUsers,
	createUser,
} = require("../../backend/src/repositories/userRepository");
const {
	clearRefreshTokens,
	getUserFromToken,
	loginUser,
	rotateRefreshToken,
	verifyToken,
} = require("../../backend/src/services/authService");

const TEST_USER = {
	email: "unit-auth-test@example.com",
	password: "secure-auth-password-999",
	name: "Auth Test User",
	role: "manager",
};

before(async () => {
	clearUsers();
	clearRefreshTokens();
	await createUser(TEST_USER);
});

test("loginUser issues access and refresh tokens with correct claims", async () => {
	const result = await loginUser({
		email: TEST_USER.email,
		password: TEST_USER.password,
	});

	assert.ok(result.user);
	assert.equal(result.user.email, TEST_USER.email);
	assert.equal(result.user.role, TEST_USER.role);

	const { accessToken, refreshToken } = result.tokens;
	assert.ok(accessToken, "access token should be present");
	assert.ok(refreshToken, "refresh token should be present");
	assert.notEqual(accessToken, refreshToken);

	const decodedAccess = verifyToken(accessToken);
	assert.equal(decodedAccess.email, TEST_USER.email);
	assert.equal(decodedAccess.role, TEST_USER.role);

	const decodedRefresh = verifyToken(refreshToken);
	assert.equal(decodedRefresh.type, "refresh");
	assert.ok(decodedRefresh.jti, "refresh token must have a unique jti claim");
});

test("loginUser rejects invalid credentials with 401", async () => {
	await assert.rejects(
		() => loginUser({ email: "wrong@example.com", password: TEST_USER.password }),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Invalid email or password.");
			return true;
		},
	);

	await assert.rejects(
		() => loginUser({ email: TEST_USER.email, password: "wrong-password" }),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Invalid email or password.");
			return true;
		},
	);
});

test("verifyToken validates JWT signatures and rejects tampered or expired tokens", () => {
	// Missing token
	assert.throws(
		() => verifyToken(null),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Authentication token is required.");
			return true;
		},
	);

	// Tampered token (invalid signature)
	const validToken = jwt.sign({ sub: "user-1" }, config.jwt.secret);
	const tamperedToken = validToken.slice(0, -5) + "abcde";
	assert.throws(
		() => verifyToken(tamperedToken),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Invalid or expired token.");
			return true;
		},
	);

	// Expired token
	const expiredToken = jwt.sign({ sub: "user-1" }, config.jwt.secret, {
		expiresIn: "-1s",
	});
	assert.throws(
		() => verifyToken(expiredToken),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Invalid or expired token.");
			return true;
		},
	);
});

test("rotateRefreshToken performs atomic token rotation and revokes previous tokens", async () => {
	const loginResult = await loginUser({
		email: TEST_USER.email,
		password: TEST_USER.password,
	});
	const oldRefreshToken = loginResult.tokens.refreshToken;

	// Rotate valid refresh token
	const newTokens = rotateRefreshToken(oldRefreshToken);
	assert.ok(newTokens.refreshToken);
	assert.notEqual(newTokens.refreshToken, oldRefreshToken);

	// Attempting to re-use the old refresh token MUST fail with 401
	assert.throws(
		() => rotateRefreshToken(oldRefreshToken),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Refresh token is not recognized.");
			return true;
		},
	);

	// Supplying an access token to refresh route MUST fail with 401
	assert.throws(
		() => rotateRefreshToken(newTokens.accessToken),
		(err) => {
			assert.equal(err.statusCode, 401);
			assert.equal(err.message, "Invalid refresh token type.");
			return true;
		},
	);
});

test("getUserFromToken returns user record for valid tokens", async () => {
	const loginResult = await loginUser({
		email: TEST_USER.email,
		password: TEST_USER.password,
	});

	const user = getUserFromToken(loginResult.tokens.accessToken);
	assert.ok(user);
	assert.equal(user.email, TEST_USER.email);
	assert.equal(user.role, TEST_USER.role);
});
