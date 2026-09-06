const {
	getConversation,
	getMemories,
	getPlans,
	getProfile,
	getReminders,
	getTasks,
} = require("../data/store");

function buildAssistantContext({
	sessionId,
	mode,
	level,
	teachingStyle,
	projectStructure,
	attachments = [],
	dailyAssistantContext = null,
}) {
	const profile = getProfile(sessionId);
	const history = getConversation(sessionId).slice(-12);
	const memories = getMemories(sessionId).slice(0, 8);
	const tasks = getTasks(sessionId).slice(0, 6);
	const reminders = getReminders(sessionId).slice(0, 6);
	const plans = getPlans(sessionId).slice(0, 3);

	return {
		mode,
		level,
		teachingStyle,
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
