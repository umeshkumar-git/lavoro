class GeminiProvider {
	constructor({ apiKey, modelNames, GoogleGenerativeAI }) {
		this.modelNames = modelNames;
		this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
	}

	isConfigured() {
		return Boolean(this.client);
	}

	async generate(prompt) {
		if (!this.client) return null;

		let lastError = null;
		for (const modelName of this.modelNames) {
			try {
				const model = this.client.getGenerativeModel({ model: modelName });
				const result = await model.generateContent(prompt);
				const response = await result.response;
				return {
					text: response.text(),
					model: modelName,
				};
			} catch (error) {
				lastError = error;
				console.error(`Gemini request failed for ${modelName}:`, error.message);
			}
		}

		throw lastError || new Error("No Gemini model was available.");
	}

	async *stream(prompt) {
		if (!this.client) return;

		let lastError = null;
		for (const modelName of this.modelNames) {
			try {
				const model = this.client.getGenerativeModel({ model: modelName });
				const result = await model.generateContentStream(prompt);

				for await (const chunk of result.stream) {
					const text = chunk.text();
					if (text) yield { text, model: modelName };
				}

				return;
			} catch (error) {
				lastError = error;
				console.error(`Gemini stream failed for ${modelName}:`, error.message);
			}
		}

		throw lastError || new Error("No Gemini streaming model was available.");
	}
}

class DemoProvider {
	async generate(_, metadata) {
		return {
			text: createDemoResponse(metadata),
			model: "demo",
		};
	}

	async *stream(_, metadata) {
		const text = createDemoResponse(metadata);
		const chunks = text.match(/.{1,80}(\s|$)/g) || [text];

		for (const chunk of chunks) {
			yield { text: chunk, model: "demo" };
		}
	}
}

function createDemoResponse(metadata = {}) {
	const mode = metadata.mode || "learn";
	const message = String(metadata.message || "").trim();

	const responses = {
		learn: `Let's learn this like an engineer.\n\nSimple idea: ${message || "the concept"} becomes easier when you connect it to inputs, state, outputs, and tradeoffs.\n\nMental model: ask what changes, what stays stable, and what can fail.\n\nExample:\n\`\`\`js\nfunction double(value) {\n  return value * 2;\n}\n\`\`\`\n\nCommon mistake: memorizing syntax without understanding data flow.\n\nSmall exercise: explain the same idea in your own words, then build a 10-line example.`,
		debug: `Debugging pass:\n\nConfirmed cause: not enough evidence yet.\nLikely cause: the issue is near the first failing boundary, such as input shape, async timing, state mutation, or configuration.\nPossible cause: dependency/version mismatch or missing environment setup.\n\nSmallest next step: paste the exact error message, the relevant code block, and what you expected to happen. Then we can rank causes instead of guessing.`,
		review: `Code review structure:\n\nMedium: I need the code to give concrete findings. Paste the file or function you want reviewed.\n\nWhen you send it, I will review correctness, edge cases, maintainability, performance, security, architecture, and tests with severity labels.`,
		pair: `Pair-programming approach:\n\n1. Define the smallest working version.\n2. Identify the data shape and API boundary.\n3. Implement one vertical slice.\n4. Verify it with a test or smoke check.\n5. Refactor only after behavior is working.\n\nTell me the feature and the current files, and we will build it step by step.`,
		project: `Project mentor outline:\n\n- Problem statement\n- Target user\n- MVP features\n- Non-functional requirements\n- Tech stack\n- Data model\n- API routes\n- Auth strategy\n- Tests\n- Deployment\n- Milestones\n\nShare your project idea and current skill level, and I will turn it into a build plan.`,
		interview: `Interview mode: I will ask one question first.\n\nQuestion: Explain the difference between an array and a linked list. When would you choose each?\n\nAnswer in your own words. After that I will score it and ask a follow-up.`,
		systemDesign: `System design mentor mode:\n\nStart with requirements before architecture. For any system, we will cover functional requirements, non-functional requirements, scale, APIs, data model, caching, queues, storage, reliability, observability, security, and tradeoffs.\n\nWhich system do you want to design?`,
		planner: `Learning path foundation:\n\n1. Programming fundamentals\n2. Data structures\n3. Algorithms\n4. Git\n5. Databases\n6. Backend APIs\n7. Frontend apps\n8. Testing\n9. System design\n10. Cloud and production engineering\n\nTell me your current level, languages, and target role, and I will personalize the path.`,
	};

	return responses[mode] || responses.learn;
}

module.exports = {
	DemoProvider,
	GeminiProvider,
};
