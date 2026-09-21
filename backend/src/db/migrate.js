const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");

/**
 * Runs all pending migrations against the given SQLite database connection.
 * @param {import("better-sqlite3").Database} db
 * @returns {string[]} Array of newly applied migration names
 */
function runMigrations(db) {
	if (!db) {
		throw new Error("Cannot run migrations: database connection is null.");
	}

	db.exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			applied_at TEXT NOT NULL
		);
	`);

	const appliedRows = db.prepare("SELECT name FROM _migrations").all();
	const appliedSet = new Set(appliedRows.map((row) => row.name));

	if (!fs.existsSync(MIGRATIONS_DIR)) {
		return [];
	}

	const files = fs
		.readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort();

	const newlyApplied = [];

	const insertMigration = db.prepare(
		"INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
	);

	for (const file of files) {
		if (appliedSet.has(file)) {
			continue;
		}

		const filePath = path.join(MIGRATIONS_DIR, file);
		const sql = fs.readFileSync(filePath, "utf8");

		const executeMigration = db.transaction(() => {
			db.exec(sql);
			insertMigration.run(file, new Date().toISOString());
		});

		executeMigration();
		newlyApplied.push(file);
	}

	return newlyApplied;
}

module.exports = {
	MIGRATIONS_DIR,
	runMigrations,
};

if (require.main === module) {
	const { initDatabase, closeDatabase } = require("./index");

	try {
		const db = initDatabase({ skipAutoMigrate: true });
		if (!db) {
			console.log(
				"⚠️  DATABASE_URL not configured. Migrations skipped (in-memory mode).",
			);
			process.exit(0);
		}

		const applied = runMigrations(db);
		if (applied.length > 0) {
			console.log(`✅ Successfully applied ${applied.length} migration(s):`);
			for (const name of applied) {
				console.log(`   - ${name}`);
			}
		} else {
			console.log("✨ Database schema is already up to date. No pending migrations.");
		}

		closeDatabase();
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	}
}

