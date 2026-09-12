const Sentry = require("@sentry/node");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { Resource } = require("@opentelemetry/resources");
const { SEMRESATTRS_SERVICE_NAME } = require("@opentelemetry/semantic-conventions");

if (process.env.SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.NODE_ENV || "development",
		tracesSampleRate: 1.0,
	});
}

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
	const sdk = new NodeSDK({
		resource: new Resource({
			[SEMRESATTRS_SERVICE_NAME]: "lavoro-backend",
		}),
		traceExporter: new OTLPTraceExporter({
			enpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
		}),
		instrumentations: [getNodeAutoInstrumentations()],
	});

	sdk.start();
}

module.exports = {
	captureException: (error, context = {}) => {
		if (process.env.SENTRY_DSN) {
			Sentry.captureException(error, context);
		}
	},
};
