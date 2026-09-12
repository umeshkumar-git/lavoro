const { getProfile, getTasks, getReminders, getPlans, getConversation } = require("../data/store");
const cache = require("../cache/redisCache");

async function buildDashboardMetrics(sessionId = "default-session") {
	const profile = getProfile(sessionId);
	const tasks = getTasks(sessionId);
	const reminders = getReminders(sessionId);
	const plans = getPlans(sessionId);
	const conversations = getConversation(sessionId);

	const activeTasks = tasks.filter((task) => task.status !== "done");
	const completedTasks = tasks.filter((task) => task.status === "done");
	const upcomingReminders = reminders.filter((reminder) => !reminder.done);

	return {
		totalTasks: tasks.length,
		activeTasks: activeTasks.length,
		completedTasks: completedTasks.length,
		totalReminders: reminders.length,
		upcomingReminders: upcomingReminders.length,
		totalPlans: plans.length,
		totalMessages: conversations.length,
		currentFocus: profile.goal || "Deliver a productive day.",
		taskBreakdown: {
			high: tasks.filter((task) => task.priority === "high").length,
			medium: tasks.filter((task) => task.priority === "medium").length,
			low: tasks.filter((task) => task.priority === "low").length,
		},
		updatedAt: new Date().toISOString(),
	};
}

async function getDashboardSummary(sessionId) {
	const cacheKey = `dashboard:summary:${sessionId}`;
	const cached = await cache.get(cacheKey);
	if (cached) {
		return { success: true, metrics: cached, cached: true };
	}

	const metrics = await buildDashboardMetrics(sessionId);
	await cache.set(cacheKey, metrics, 300);
	return { success: true, metrics, cached: false };
}

module.exports = {
	buildDashboardMetrics,
	getDashboardSummary,
};
