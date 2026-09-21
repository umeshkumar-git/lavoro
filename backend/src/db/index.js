const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { runMigrations } = require("./migrate");

let _db = null;
let _hasLoggedFallback = false;

/**
 * Resolves the SQLite database file path from DATABASE_URL or SQLITE_PATH.
 * Supported formats:
 * - "sqlite://:memory:" or ":memory:" -> In-memory SQLite
 * - "sqlite:///absolute/path/to/db.sqlite" -> Absolute path
 * - "sqlite://./data/lavoro.db" -> Relative path (resolved from project root)
 * - "./data/lavoro.db" or "/path/to/db.db" -> Direct path
 *
 * @param {string} [url]
 * @returns {string|null} Resolved file path, ":memory:", or null if unset
 */
function resolveDbPath(url) {
	const raw = url || process.env.DATABASE_URL || process.env.SQLITE_PATH;
	if (!raw) return null;

	const trimmed = raw.trim();
	if (!trimmed) return null;

	if (trimmed === ":memory:" || trimmed === "sqlite://:memory:") {
		return ":memory:";
	}

	let cleanPath = trimmed;
	if (cleanPath.startsWith("sqlite://")) {
		cleanPath = cleanPath.slice("sqlite://".length);
	}

	if (path.isAbsolute(cleanPath)) {
		return cleanPath;
	}

	const projectRoot = path.resolve(__dirname, "../../..");
	return path.resolve(projectRoot, cleanPath);
}

/**
 * Initializes the SQLite database and executes pending migrations.
 * @param {Object} [options]
 * @param {string} [options.url] Custom database URL/path
 * @param {boolean} [options.force] Force re-initialization
 * @returns {import("better-sqlite3").Database|null}
 */
function initDatabase(options = {}) {
	if (_db && !options.force) {
		return _db;
	}

	if (_db) {
		try {
			_db.close();
		} catch (_) {}
		_db = null;
	}

	const dbPath = resolveDbPath(options.url);

	if (!dbPath) {
		if (!_hasLoggedFallback && process.env.NODE_ENV !== "test") {
			console.warn(
				"⚠️  DATABASE_URL is not set — falling back to ephemeral in-memory storage (data will vanish on restart). Set DATABASE_URL to enable real persistence (e.g., sqlite://./data/lavoro.db).",
			);
			_hasLoggedFallback = true;
		}
		return null;
	}

	if (dbPath !== ":memory:") {
		const dir = path.dirname(dbPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	const db = new Database(dbPath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	// Run migrations automatically unless explicitly skipped
	if (!options.skipAutoMigrate) {
		runMigrations(db);
	}

	_db = db;
	return _db;
}

/**
 * Returns the currently active database connection, initializing if necessary.
 * @returns {import("better-sqlite3").Database|null}
 */
function getDb() {
	if (_db) return _db;
	return initDatabase();
}

/**
 * Checks if a persistent database is configured and active.
 * @returns {boolean}
 */
function isConfigured() {
	return Boolean(getDb());
}

/**
 * Closes the active database connection if open.
 */
function closeDatabase() {
	if (_db) {
		try {
			_db.close();
		} catch (_) {}
		_db = null;
	}
}

module.exports = {
	closeDatabase,
	getDb,
	initDatabase,
	isConfigured,
	resolveDbPath,
};
