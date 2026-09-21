const path = require("path");
const { createUser, findByEmail } = require("../backend/src/repositories/userRepository");
const { USER_ROLES } = require("../backend/src/shared/constants");

const DEV_SEED_PASSWORD =
	process.env.DEV_SEED_PASSWORD || "dev-seed-password-do-not-use-in-prod";

const demoUsers = [
	{
		id: "user-admin-1",
		email: "admin@example.com",
		password: DEV_SEED_PASSWORD,
		name: "System Admin",
		role: USER_ROLES.ADMIN,
	},
	{
		id: "user-manager-1",
		email: "manager@example.com",
		password: DEV_SEED_PASSWORD,
		name: "Operations Manager",
		role: USER_ROLES.MANAGER,
	},
	{
		id: "user-regular-1",
		email: "user@example.com",
		password: DEV_SEED_PASSWORD,
		name: "Team Member",
		role: USER_ROLES.USER,
	},
];

/**
 * Seeds demo accounts for local development and testing.
 * Strictly forbidden in production environments.
 * @returns {Promise<boolean>} True if seeded, false if skipped due to production environment.
 */
async function seedUsers() {
	if (process.env.NODE_ENV === "production") {
		console.warn(
			"⚠️  Skipping demo user seeding: NODE_ENV is set to 'production'. Demo accounts are never created in production.",
		);
		return false;
	}

	for (const userData of demoUsers) {
		if (!findByEmail(userData.email)) {
			await createUser(userData);
		}
	}

	return true;
}

if (require.main === module) {
	seedUsers()
		.then((seeded) => {
			if (seeded) {
				console.log(
					`✅ Seeded ${demoUsers.length} demo accounts for development with hashed passwords.`,
				);
				console.log(`🔑 Dev password: "${DEV_SEED_PASSWORD}"`);
			}
		})
		.catch((error) => {
			console.error("❌ Failed to seed demo users:", error);
			process.exit(1);
		});
}

module.exports = {
	DEV_SEED_PASSWORD,
	demoUsers,
	seedUsers,
};
