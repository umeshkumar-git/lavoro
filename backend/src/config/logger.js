const pino = require("pino");

const logger = pino({
	name: "lavoro-backend",
	level: process.env.LOG_LEVEL || "info",
	timestamp: pino.stdTimeFunctions.isoTime,
	formatters: {
		bindings(bindings) {
			return { ...bindings, service: "lavoro-backend" };
		},
	},
});

module.exports = logger;
