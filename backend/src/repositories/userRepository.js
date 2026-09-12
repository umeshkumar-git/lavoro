const { USER_ROLES } = require("../shared/constants");

const users = new Map([
	[
		"admin@example.com",
		{
			id: "user-admin-1",
			email: "admin@example.com",
			password: "Password123!",
			name: "System Admin",
			role: USER_ROLES.ADMIN,
		},
	],
	[
		"manager@example.com",
		{
			id: "user-manager-1",
			email: "manager@example.com",
			password: "Password123!",
			name: "Operations Manager",
			role: USER_ROLES.MANAGER,
		},
	],
	[
		"user@example.com",
		{
			id: "user-regular-1",
			email: "user@example.com",
			password: "Password123!",
			name: "Team Member",
			role: USER_ROLES.USER,
		},
	],
]);

function findByEmail(email) {
	const normalizedEmail = String(email || "").trim().toLowerCase();
	return users.get(normalizedEmail) || null;
}

function findById(id) {
	for (const user of users.values()) {
		if (user.id === id) return user;
	}
	return null;
}

module.exports = {
	findByEmail,
	findById,
	users,
};
