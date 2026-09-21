const {
	getConversation,
	getMemories,
	getPlans,
	getProfile,
	getReminders,
	getTasks,
} = require("../data/store");

/**
 * Builds the comprehensive productivity context for the AI agent.
 */
function buildAssistantContext({
	sessionId,
	mode,
	projectStructure = null,
	attachments = [],
	dailyAssistantContext = null,
}) {
	const profile = getProfile(sessionId);
	const history = getConversation(sessionId).slice(-12);
	const memories = getMemories(sessionId).slice(0, 8);
	const tasks = getTasks(sessionId).slice(0, 8);
	const reminders = getReminders(sessionId).slice(0, 8);
	const plans = getPlans(sessionId).slice(0, 3);

	return {
		mode,
		profile,
		history,
		memories,
		tasks,
		reminders,
		plans,
		dailyAssistant: dailyAssistantContext,
		project: projectStructure
			? {
					summary: projectStructure.summary,
					files: projectStructure.files.slice(0, 80),
				}
			: null,
		attachments: attachments.map((attachment) => ({
			name: String(attachment.name || "attachment").slice(0, 120),
			language: String(attachment.language || "text").slice(0, 40),
			content: String(attachment.content || "").slice(0, 12_000),
		})),
	};
}

module.exports = {
	buildAssistantContext,
};
