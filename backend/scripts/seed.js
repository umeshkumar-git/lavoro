module.exports = require("../../scripts/seed");

if (require.main === module) {
	const { seedUsers, demoUsers, DEV_SEED_PASSWORD } = module.exports;
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
