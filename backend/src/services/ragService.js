const { getDb } = require("../db");

/**
 * In-memory fallback documents used only when DATABASE_URL is unset.
 */
const memoryDocuments = [];

function indexDocuments(documents = []) {
	const normalizedDocuments = documents.map((document) => {
		const content = String(document?.content || "").trim();
		if (!content) return null;

		return {
			id: String(
				document?.id ||
					`doc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
			),
			content,
			metadata: document?.metadata || {},
			embedding: createEmbedding(content),
		};
	});

	const validDocs = normalizedDocuments.filter(Boolean);
	const db = getDb();

	if (db) {
		const insertDoc = db.prepare(`
			INSERT OR REPLACE INTO rag_documents (id, content, metadata_json, embedding_json, created_at)
			VALUES (@id, @content, @metadataJson, @embeddingJson, @createdAt)
		`);

		const tx = db.transaction(() => {
			for (const doc of validDocs) {
				insertDoc.run({
					id: doc.id,
					content: doc.content,
					metadataJson: JSON.stringify(doc.metadata || {}),
					embeddingJson: JSON.stringify(doc.embedding),
					createdAt: new Date().toISOString(),
				});
			}
		});

		tx();
		return validDocs.map((doc) => ({
			id: doc.id,
			score: 1,
			metadata: doc.metadata,
		}));
	}

	memoryDocuments.push(...validDocs);
	return validDocs.map((doc) => ({
		id: doc.id,
		score: 1,
		metadata: doc.metadata,
	}));
}

function queryDocuments(query, limit = 5) {
	const normalizedQuery = String(query || "").trim();
	if (!normalizedQuery) {
		return [];
	}

	const queryEmbedding = createEmbedding(normalizedQuery);
	const db = getDb();

	if (db) {
		const rows = db
			.prepare("SELECT id, content, metadata_json, embedding_json FROM rag_documents")
			.all();

		return rows
			.map((row) => ({
				id: row.id,
				content: row.content,
				metadata: JSON.parse(row.metadata_json || "{}"),
				score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding_json)),
			}))
			.sort((left, right) => right.score - left.score)
			.slice(0, limit)
			.map(({ id, content, score, metadata }) => ({
				id,
				content,
				score: Number(score.toFixed(4)),
				metadata,
			}));
	}

	return memoryDocuments
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
}

function clearDocuments() {
	const db = getDb();
	if (db) {
		db.prepare("DELETE FROM rag_documents").run();
	}
	memoryDocuments.length = 0;
}

function createEmbedding(text) {
	const tokens =
		String(text || "")
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

	const magnitude =
		Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
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
	clearDocuments,
	indexDocuments,
	memoryDocuments,
	queryDocuments,
};
