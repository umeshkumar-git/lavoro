const bcrypt = require("bcrypt");
const { USER_ROLES } = require("../shared/constants");
const { getDb } = require("../db");

const SALT_ROUNDS = 10;

/**
 * In-memory fallback map used only when DATABASE_URL is unset.
 */
const users = new Map();

/**
 * Creates and stores a new user with a bcrypt-hashed password.
 * Persists to SQLite if configured, otherwise falls back to memory.
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

	const db = getDb();
	if (db) {
		db.prepare(`
			INSERT INTO users (id, email, password, name, role, created_at, updated_at)
			VALUES (@id, @email, @password, @name, @role, @createdAt, @createdAt)
		`).run({
			id: user.id,
			email: user.email,
			password: user.password,
			name: user.name,
			role: user.role,
			createdAt: user.createdAt,
		});
		return user;
	}

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
	if (!normalizedEmail) return null;

	const db = getDb();
	if (db) {
		const row = db
			.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
			.get(normalizedEmail);
		if (!row) return null;

		return {
			id: row.id,
			email: row.email,
			password: row.password,
			name: row.name || "",
			role: row.role,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	return users.get(normalizedEmail) || null;
}

/**
 * Finds a user by unique ID.
 * @param {string} id
 * @returns {Object|null}
 */
function findById(id) {
	if (!id) return null;

	const db = getDb();
	if (db) {
		const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
		if (!row) return null;

		return {
			id: row.id,
			email: row.email,
			password: row.password,
			name: row.name || "",
			role: row.role,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	for (const user of users.values()) {
		if (user.id === id) return user;
	}
	return null;
}

/**
 * Clears all users (useful for test resets).
 */
function clearUsers() {
	const db = getDb();
	if (db) {
		db.prepare("DELETE FROM users").run();
	}
	users.clear();
}

module.exports = {
	clearUsers,
	createUser,
	findByEmail,
	findById,
	users,
};
