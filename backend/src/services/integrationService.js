const connectors = [
	{
		id: "google-calendar",
		name: "Google Calendar",
		type: "oauth",
		authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		scopes: ["calendar.events.readonly", "calendar.events.write"],
		status: "available",
	},
	{
		id: "slack",
		name: "Slack",
		type: "oauth",
		authUrl: "https://slack.com/oauth/v2/authorize",
		scopes: ["chat:write", "channels:read"],
		status: "available",
	},
	{
		id: "github",
		name: "GitHub",
		type: "oauth",
		authUrl: "https://github.com/login/oauth/authorize",
		scopes: ["repo", "read:org"],
		status: "available",
	},
];

const connections = new Map();
const webhookEvents = [];

function listConnectors() {
	return connectors.map((connector) => ({ ...connector }));
}

function connectProvider(provider, { code, redirectUri } = {}) {
	const target = connectors.find((connector) => connector.id === provider);
	if (!target) {
		throw Object.assign(new Error("Unsupported integration provider."), {
			statusCode: 400,
		});
	}

	const connectionId = `${provider}-${Date.now()}`;
	const connection = {
		id: connectionId,
		provider,
		connectedAt: new Date().toISOString(),
		status: "connected",
		code: code || "demo-code",
		redirectUri: redirectUri || "http://localhost:10000/api/integrations/callback",
	};
	connections.set(connectionId, connection);

	return {
		success: true,
		connection,
	};
}

function handleWebhook(provider, payload = {}) {
	const target = connectors.find((connector) => connector.id === provider);
	if (!target) {
		throw Object.assign(new Error("Unsupported webhook provider."), {
			statusCode: 400,
		});
	}

	const event = {
		id: `hook-${Date.now()}`,
		provider,
		receivedAt: new Date().toISOString(),
		payload,
	};
	webhookEvents.push(event);

	return {
		success: true,
		message: `${provider} webhook received successfully.`,
		event,
	};
}

module.exports = {
	connectProvider,
	handleWebhook,
	listConnectors,
	connections,
	webhookEvents,
};
