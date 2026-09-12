const memoryDocuments = [];

function indexDocuments(documents = []) {
	const normalizedDocuments = documents.map((document) => {
		const content = String(document?.content || "").trim();
		if (!content) return null;

		return {
			id: String(document?.id || `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`),
			content,
			metadata: document?.metadata || {},
			embedding: createEmbedding(content),
		};
	});

	const validDocs = normalizedDocuments.filter(Boolean);
	memoryDocuments.push(...validDocs);

	return validDocs.map((doc) => ({ id: doc.id, score: 1, metadata: doc.metadata }));
}

function queryDocuments(query, limit = 5) {
	const normalizedQuery = String(query || "").trim();
	if (!normalizedQuery) {
		return [];
	}

	const queryEmbedding = createEmbedding(normalizedQuery);
	const hits = memoryDocuments
		.map((document) => ({
			...document,
			score: cosineSimilarity(queryEmbedding, document.embedding),
		}))
		.sort((left, right) => right.score - left.score)
		.slice(0, limit)
		.map(({ id, content, score, metadata }) => ({
			id,
			content,
			score: Number(score.toFixed(4)),
			metadata,
		}));

	return hits;
}

function createEmbedding(text) {
	const tokens = String(text || "")
		.toLowerCase()
		.match(/[a-z0-9]+/g) || [];

	const vector = Array.from({ length: 8 }, () => 0);
	for (const token of tokens) {
		const seed = token
			.split("")
			.reduce((total, char) => total + char.charCodeAt(0), 0);
		const index = Math.abs(seed) % vector.length;
		vector[index] += 1;
	}

	const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
	return vector.map((value) => Number((value / magnitude).toFixed(4)));
}

function cosineSimilarity(left, right) {
	if (!left || !right || left.length !== right.length) return 0;
	const dotProduct = left.reduce((sum, item, index) => sum + item * right[index], 0);
	const leftMagnitude = Math.sqrt(left.reduce((sum, item) => sum + item * item, 0));
	const rightMagnitude = Math.sqrt(right.reduce((sum, item) => sum + item * item, 0));
	if (!leftMagnitude || !rightMagnitude) return 0;
	return dotProduct / (leftMagnitude * rightMagnitude);
}

module.exports = {
	indexDocuments,
	queryDocuments,
	memoryDocuments,
};
