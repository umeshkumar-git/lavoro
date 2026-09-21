const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDb } = require("../db");

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 100;
const EMBEDDING_MODELS = ["gemini-embedding-001", "gemini-embedding-2-preview"];

let _geminiClient = null;
let _hasLoggedEmbeddingFallback = false;

/**
 * In-memory fallback documents used only when DATABASE_URL is unset.
 */
const memoryDocuments = [];

function getGeminiClient() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) return null;
	if (!_geminiClient) {
		_geminiClient = new GoogleGenerativeAI(apiKey);
	}
	return _geminiClient;
}

/**
 * Splits text into overlapping chunks along natural boundary breaks (paragraphs, sentences, words).
 * @param {string} text
 * @param {number} [chunkSize=500]
 * @param {number} [overlap=100]
 * @returns {string[]}
 */
function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
	const content = String(text || "").trim();
	if (!content) return [];
	if (content.length <= chunkSize) return [content];

	const chunks = [];
	let start = 0;

	while (start < content.length) {
		let end = Math.min(start + chunkSize, content.length);

		if (end < content.length) {
			// Attempt to find a clean break point looking backwards
			const slice = content.slice(start, end);
			const paragraphBreak = slice.lastIndexOf("\n\n");
			const newlineBreak = slice.lastIndexOf("\n");
			const sentenceBreak = slice.lastIndexOf(". ");
			const wordBreak = slice.lastIndexOf(" ");

			const minBreakPoint = Math.floor(chunkSize * 0.4);
			let chosenBreak = -1;

			if (paragraphBreak > minBreakPoint) {
				chosenBreak = paragraphBreak + 2;
			} else if (newlineBreak > minBreakPoint) {
				chosenBreak = newlineBreak + 1;
			} else if (sentenceBreak > minBreakPoint) {
				chosenBreak = sentenceBreak + 2;
			} else if (wordBreak > minBreakPoint) {
				chosenBreak = wordBreak + 1;
			}

			if (chosenBreak > 0) {
				end = start + chosenBreak;
			}
		}

		const chunk = content.slice(start, end).trim();
		if (chunk.length > 0) {
			chunks.push(chunk);
		}

		if (end >= content.length) {
			break;
		}

		start = Math.max(start + 1, end - overlap);
	}

	return chunks;
}

/**
 * Chunks a document object into one or more chunk objects with parent metadata.
 * @param {Object} doc
 * @param {Object} [options]
 * @returns {Array<Object>}
 */
function chunkDocument(doc, options = {}) {
	const content = String(doc?.content || "").trim();
	if (!content) return [];

	const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
	const overlap = options.overlap || DEFAULT_CHUNK_OVERLAP;
	const baseId = String(
		doc.id || `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
	);

	const rawChunks = chunkText(content, chunkSize, overlap);
	if (rawChunks.length <= 1) {
		return [
			{
				id: baseId,
				content,
				metadata: {
					...(doc.metadata || {}),
					chunkIndex: 0,
					totalChunks: 1,
					parentDocId: baseId,
				},
			},
		];
	}

	return rawChunks.map((chunkContent, idx) => ({
		id: `${baseId}#chunk-${idx}`,
		content: chunkContent,
		metadata: {
			...(doc.metadata || {}),
			parentDocId: baseId,
			chunkIndex: idx,
			totalChunks: rawChunks.length,
		},
	}));
}

/**
 * Generates vector embeddings for a given text snippet.
 * Uses Gemini's neural embedding model if API key is present; otherwise
 * uses a deterministic local term-frequency/n-gram embedding generator for offline testing.
 * @param {string} text
 * @returns {Promise<number[]>} Vector of floats
 */
async function generateEmbedding(text) {
	const client = getGeminiClient();

	if (client) {
		for (const modelName of EMBEDDING_MODELS) {
			try {
				const model = client.getGenerativeModel({ model: modelName });
				const res = await model.embedContent(text);
				if (res?.embedding?.values) {
					return res.embedding.values;
				}
			} catch (_) {}
		}
	}

	if (!_hasLoggedEmbeddingFallback && process.env.NODE_ENV !== "test") {
		console.warn(
			"⚠️  GEMINI_API_KEY not configured or embedding API unavailable — using deterministic local embedding generator for test/dev mode.",
		);
		_hasLoggedEmbeddingFallback = true;
	}

	return createLocalDeterministicEmbedding(text);
}

/**
 * Deterministic local 64-dimensional n-gram embedding generator with L2 normalization.
 * Used for offline CI runs and development without external API costs.
 * @param {string} text
 * @returns {number[]}
 */
function createLocalDeterministicEmbedding(text) {
	const dim = 64;
	const vector = new Array(dim).fill(0);
	const tokens = String(text || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		let hash = 0;
		for (let j = 0; j < token.length; j++) {
			hash = (hash * 31 + token.charCodeAt(j)) >>> 0;
		}
		vector[hash % dim] += 1;

		if (i < tokens.length - 1) {
			const bigram = `${token}_${tokens[i + 1]}`;
			let biHash = 0;
			for (let j = 0; j < bigram.length; j++) {
				biHash = (biHash * 37 + bigram.charCodeAt(j)) >>> 0;
			}
			vector[biHash % dim] += 1.5;
		}
	}

	const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
	return vector.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Computes cosine similarity between two float vectors.
 * @param {number[]} left
 * @param {number[]} right
 * @returns {number} Value between -1.0 and 1.0
 */
function cosineSimilarity(left, right) {
	if (!left || !right || left.length !== right.length) return 0;
	let dot = 0;
	let leftNorm = 0;
	let rightNorm = 0;

	for (let i = 0; i < left.length; i++) {
		dot += left[i] * right[i];
		leftNorm += left[i] * left[i];
		rightNorm += right[i] * right[i];
	}

	const magnitude = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
	if (!magnitude) return 0;
	return dot / magnitude;
}

/**
 * Indexes documents into SQLite (or in-memory fallback) after chunking and embedding.
 * @param {Array<Object>} documents
 * @returns {Promise<Array<Object>>}
 */
async function indexDocuments(documents = []) {
	const allChunks = [];

	for (const doc of documents) {
		const chunks = chunkDocument(doc);
		for (const chunk of chunks) {
			const embedding = await generateEmbedding(chunk.content);
			allChunks.push({
				...chunk,
				embedding,
			});
		}
	}

	const db = getDb();
	if (db) {
		const insertDoc = db.prepare(`
			INSERT OR REPLACE INTO rag_documents (id, content, metadata_json, embedding_json, created_at)
			VALUES (@id, @content, @metadataJson, @embeddingJson, @createdAt)
		`);

		const tx = db.transaction(() => {
			for (const item of allChunks) {
				insertDoc.run({
					id: item.id,
					content: item.content,
					metadataJson: JSON.stringify(item.metadata || {}),
					embeddingJson: JSON.stringify(item.embedding),
					createdAt: new Date().toISOString(),
				});
			}
		});

		tx();
		return allChunks.map((doc) => ({
			id: doc.id,
			score: 1,
			metadata: doc.metadata,
		}));
	}

	memoryDocuments.push(...allChunks);
	return allChunks.map((doc) => ({
		id: doc.id,
		score: 1,
		metadata: doc.metadata,
	}));
}

/**
 * Queries the knowledge base using vector cosine similarity.
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {Promise<Array<Object>>}
 */
async function queryDocuments(query, limit = 5) {
	const normalizedQuery = String(query || "").trim();
	if (!normalizedQuery) {
		return [];
	}

	const queryEmbedding = await generateEmbedding(normalizedQuery);
	const db = getDb();

	let candidates = [];
	if (db) {
		const rows = db
			.prepare("SELECT id, content, metadata_json, embedding_json FROM rag_documents")
			.all();

		candidates = rows.map((row) => ({
			id: row.id,
			content: row.content,
			metadata: JSON.parse(row.metadata_json || "{}"),
			embedding: JSON.parse(row.embedding_json),
		}));
	} else {
		candidates = memoryDocuments;
	}

	return candidates
		.map((item) => ({
			id: item.id,
			content: item.content,
			metadata: item.metadata,
			score: Number(cosineSimilarity(queryEmbedding, item.embedding).toFixed(4)),
		}))
		.sort((left, right) => right.score - left.score)
		.slice(0, limit);
}

function clearDocuments() {
	const db = getDb();
	if (db) {
		db.prepare("DELETE FROM rag_documents").run();
	}
	memoryDocuments.length = 0;
}

module.exports = {
	chunkDocument,
	chunkText,
	clearDocuments,
	cosineSimilarity,
	generateEmbedding,
	indexDocuments,
	memoryDocuments,
	queryDocuments,
};
