-- Migration 003: Create RAG documents table

CREATE TABLE IF NOT EXISTS rag_documents (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    embedding_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_created ON rag_documents(created_at);
