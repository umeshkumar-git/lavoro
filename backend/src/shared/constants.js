const USER_ROLES = Object.freeze({
	ADMIN: "admin",
	USER: "user",
	MANAGER: "manager",
});

const AUTH_SCOPES = Object.freeze({
	READ_DASHBOARD: "dashboard:read",
	WRITE_TASKS: "tasks:write",
	WRITE_JOBS: "jobs:write",
	READ_ADMIN: "admin:read",
});

module.exports = {
	USER_ROLES,
	AUTH_SCOPES,
};
