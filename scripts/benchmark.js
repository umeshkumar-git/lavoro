// BENCHMARK_MODE routes requests through DemoProvider to measure local server
// and orchestrator overhead isolated from upstream Gemini API latency.
process.env.BENCHMARK_MODE = "true";


const http = require("http");
const autocannon = require("autocannon");
const app = require("../backend/src/app");

async function runBenchmark(name, options) {
	return new Promise((resolve, reject) => {
		console.log(`\n🚀 Starting benchmark for ${name}...`);
		const instance = autocannon(options, (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});

		autocannon.track(instance, { renderProgressBar: false });
	});
}

function summarizeResult(result) {
	return {
		requestsTotal: result.requests.total,
		requestsPerSec: Number(result.requests.average).toFixed(1),
		throughputMbPerSec: (result.throughput.average / (1024 * 1024)).toFixed(2),
		latencyP50: result.latency.p50,
		latencyP90: result.latency.p90,
		latencyP95: result.latency.p97_5 || result.latency.p99 || result.latency.p90,
		latencyP99: result.latency.p99,
		latencyMax: result.latency.max,
	};
}

async function main() {
	// Bind to an available random port
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const port = server.address().port;
	const baseUrl = `http://127.0.0.1:${port}`;

	console.log(`⚡ Benchmark server listening on ${baseUrl}`);

	try {
		// 1. Benchmark POST /api/ai/chat
		const chatResult = await runBenchmark("POST /api/ai/chat (JSON agent response)", {
			url: `${baseUrl}/api/ai/chat`,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				message: "What is my morning briefing?",
				sessionId: "bench-chat-user",
			}),
			duration: 5,
			connections: 10,
			pipelining: 1,
		});

		// 2. Benchmark POST /api/ai/stream
		const streamResult = await runBenchmark("POST /api/ai/stream (SSE streaming)", {
			url: `${baseUrl}/api/ai/stream`,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				message: "Plan my workday schedule",
				sessionId: "bench-stream-user",
			}),
			duration: 5,
			connections: 10,
			pipelining: 1,
		});

		const chatSummary = summarizeResult(chatResult);
		const streamSummary = summarizeResult(streamResult);

		console.log("\n==================================================");
		console.log("📊 AUTOCANNON BENCHMARK REPORT");
		console.log("==================================================");

		console.log("\nEndpoint: POST /api/ai/chat");
		console.log(`- Requests/sec: ${chatSummary.requestsPerSec}`);
		console.log(`- Throughput:   ${chatSummary.throughputMbPerSec} MB/s`);
		console.log(`- Latency p50:  ${chatSummary.latencyP50} ms`);
		console.log(`- Latency p90:  ${chatSummary.latencyP90} ms`);
		console.log(`- Latency p95:  ${chatSummary.latencyP95} ms`);
		console.log(`- Latency p99:  ${chatSummary.latencyP99} ms`);

		console.log("\nEndpoint: POST /api/ai/stream (SSE)");
		console.log(`- Requests/sec: ${streamSummary.requestsPerSec}`);
		console.log(`- Throughput:   ${streamSummary.throughputMbPerSec} MB/s`);
		console.log(`- Latency p50:  ${streamSummary.latencyP50} ms`);
		console.log(`- Latency p90:  ${streamSummary.latencyP90} ms`);
		console.log(`- Latency p95:  ${streamSummary.latencyP95} ms`);
		console.log(`- Latency p99:  ${streamSummary.latencyP99} ms`);
		console.log("==================================================\n");

		return { chatSummary, streamSummary };
	} finally {
		await new Promise((resolve) => server.close(resolve));
		console.log("Benchmark server stopped.");
	}
}

if (require.main === module) {
	main().catch((err) => {
		console.error("Benchmark failed:", err);
		process.exit(1);
	});
}

module.exports = { main };
