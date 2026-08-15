const MAX_HISTORY_MESSAGES = 24;

const DEFAULT_PROFILE = {
	experienceLevel: "intermediate",
	languages: ["JavaScript"],
	technologies: ["HTML", "CSS", "Node.js"],
	goal: "Become a professional software engineer",
	currentProject: "Developer Mentor AI",
	studyTime: "45 minutes per day",
	targetRole: "Full-stack developer",
	preferredStyle: "direct",
	strongTopics: [],
	weakTopics: [],
	completedLessons: [],
	interviewScores: [],
	codingMistakes: [],
};

const sessions = new Map();

function createSession() {
	return {
		profile: { ...DEFAULT_PROFILE },
		conversations: [],
		projects: [],
		memories: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

function getSession(sessionId) {
	if (!sessions.has(sessionId)) {
		sessions.set(sessionId, createSession());
	}

	return sessions.get(sessionId);
}

function getProfile(sessionId) {
	return getSession(sessionId).profile;
}

function updateProfile(sessionId, updates) {
	const session = getSession(sessionId);
	const nextProfile = {
		...session.profile,
		...updates,
		languages: normalizeList(updates.languages, session.profile.languages),
		technologies: normalizeList(updates.technologies, session.profile.technologies),
		strongTopics: normalizeList(updates.strongTopics, session.profile.strongTopics),
		weakTopics: normalizeList(updates.weakTopics, session.profile.weakTopics),
	};

	session.profile = nextProfile;
	session.updatedAt = new Date().toISOString();
	return nextProfile;
}

function getConversation(sessionId) {
	return getSession(sessionId).conversations;
}

function appendMessage(sessionId, message) {
	const session = getSession(sessionId);
	session.conversations.push({
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: new Date().toISOString(),
		...message,
	});

	if (session.conversations.length > MAX_HISTORY_MESSAGES) {
		session.conversations.splice(
			0,
			session.conversations.length - MAX_HISTORY_MESSAGES,
		);
	}

	session.updatedAt = new Date().toISOString();
	return session.conversations;
}

function addMemory(sessionId, memory) {
	const session = getSession(sessionId);
	session.memories.unshift({
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: new Date().toISOString(),
		...memory,
	});
	session.memories = session.memories.slice(0, 20);
	session.updatedAt = new Date().toISOString();
	return session.memories;
}

function getMemories(sessionId) {
	return getSession(sessionId).memories;
}

function resetSession(sessionId) {
	sessions.set(sessionId, {
		...createSession(),
		profile: getProfile(sessionId),
	});
	return getSession(sessionId);
}

function normalizeList(value, fallback) {
	if (!Array.isArray(value)) return fallback || [];
	return value
		.map((item) => String(item).trim())
		.filter(Boolean)
		.slice(0, 20);
}

module.exports = {
	DEFAULT_PROFILE,
	addMemory,
	appendMessage,
	getConversation,
	getMemories,
	getProfile,
	getSession,
	resetSession,
	updateProfile,
};
