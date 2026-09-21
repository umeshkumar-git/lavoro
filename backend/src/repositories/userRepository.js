const bcrypt = require("bcrypt");
const { USER_ROLES } = require("../shared/constants");

const SALT_ROUNDS = 10;

/**
 * In-memory user store.
 * NOTE: For local-dev/Phase 0 scope. Passwords must never be stored in plaintext.
 */
const users = new Map();

/**
 * Creates and stores a new user with a bcrypt-hashed password.
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} params.email
 * @param {string} params.password - Plaintext password to be hashed
 * @param {string} [params.name]
 * @param {string} [params.role]
 * @returns {Promise<Object>} Created user record (with hashed password)
 */
async function createUser({ id, email, password, name, role }) {
	if (!email || !password) {
		throw new Error("Email and password are required to create a user.");
	}

	const normalizedEmail = String(email).trim().toLowerCase();
	const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

	const user = {
		id: id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		email: normalizedEmail,
		password: hashedPassword,
		name: name || "",
		role: role || USER_ROLES.USER,
		createdAt: new Date().toISOString(),
	};

	users.set(normalizedEmail, user);
	return user;
}

/**
 * Finds a user by email (case-insensitive).
 * @param {string} email
 * @returns {Object|null}
 */
function findByEmail(email) {
	const normalizedEmail = String(email || "").trim().toLowerCase();
	return users.get(normalizedEmail) || null;
}

/**
 * Finds a user by unique ID.
 * @param {string} id
 * @returns {Object|null}
 */
function findById(id) {
	for (const user of users.values()) {
		if (user.id === id) return user;
	}
	return null;
}

/**
 * Clears all users (useful for test resets).
 */
function clearUsers() {
	users.clear();
}

module.exports = {
	clearUsers,
	createUser,
	findByEmail,
	findById,
	users,
};
