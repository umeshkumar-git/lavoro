# Lavoro — Resume Bullets, Verbal Pitch & Technical Interview Guide

This guide is your complete, battle-tested preparation sheet for technical interviews and internship screening calls. Every claim, number, and architectural decision here is backed by working code, automated test suites, and reproducible benchmarks in the repository.

---

## 1. Three Quantified Resume Bullets

### Option A (Full-Stack / AI Focus)
> **AI Productivity Platform & Agent Engine (Lavoro)** | *Node.js, Express, Gemini Function Calling, SQLite, Zod, Supertest*
> - Engineered an autonomous ReAct tool-calling AI agent using Gemini’s native function-calling API with a multi-step Plan-Act-Observe-Synthesize loop, verified against an 18-prompt regression eval suite achieving **100% tool-selection accuracy**.
> - Upgraded RAG retrieval to 3,072-dimensional neural embeddings (`gemini-embedding-001`) with sliding-window chunking (500-char window, 100-char overlap) and in-process SQLite vector cosine scanning, eliminating third-party vector SaaS latency and failure modes.
> - Hardened Express backend with Helmet headers, strict Zod request validation, and auth rate limiting (5 req/min); load-tested via Autocannon achieving **7,133 req/s at 1ms p50 / 2ms p95 latency** (measured against the local agent loop with the demo provider, isolating server overhead from upstream Gemini latency) and **85.2% line coverage** across 54 in-process tests.

### Option B (Backend & Systems Focus)
> **Backend & Systems Engineering (Lavoro)** | *Node.js, Express 5, better-sqlite3 (WAL), OpenTelemetry, Pino, c8*
> - Built an embedded persistence layer using SQLite (`better-sqlite3`) in WAL mode with automated migrations for users, sessions, refresh tokens, and jobs, replacing ephemeral state with crash-resilient persistence.
> - Implemented atomic refresh token rotation with single-use `jti` claims and bcrypt credential hashing, blocking token reuse and session hijacking attacks.
> - Replaced live-port smoke tests with in-process Supertest integration tests; authored pure-logic unit test suites (path traversal security assertions, mode heuristics, token rotation) and achieved **85% line coverage** in CI on Node 20.

### Option C (Concise Single-Bullet Summary)
> - Built **Lavoro**, an AI agent productivity platform in Node.js/Express featuring Gemini function-calling with a 4-step tool loop (100% eval accuracy across 18 test cases), 3,072D neural RAG, SQLite WAL persistence, and security hardening benchmarked at **7,133 req/s (1ms p50 / 2ms p95)** (measured against the local agent loop with the demo provider, isolating server overhead from upstream Gemini latency) with **85% line coverage** across 54 automated tests.

---

## 2. The 90-Second Verbal Pitch

*(Practice saying this out loud without notes. Target speaking time: ~75–90 seconds at a calm, natural cadence.)*

> "Hi, I built **Lavoro**, a production-grade AI personal daily assistant and productivity platform in Node.js and Express.
>
> Most portfolio AI projects are just chatbots with a prompt—they take text and return text. I wanted to build an actual autonomous agent that changes state. Using Gemini's native function-calling API, I built a ReAct agent loop: the model inspects the user’s request, decides which domain tools to call—like creating a high-priority task, scheduling a reminder, searching the codebase, or time-blocking a daily schedule—executes them, observes the results, and synthesizes a final natural-language response. I wrote a deterministic 18-case evaluation benchmark that runs in our CI to verify 100% tool-selection accuracy.
>
> On the systems side, I focused heavily on engineering rigor. I replaced volatile in-memory storage with an embedded SQLite database using `better-sqlite3` in Write-Ahead Logging mode with schema migrations, so user sessions, RAG vectors, and background jobs survive server restarts. For retrieval-augmented generation, instead of a toy hash, I integrated 3,072-dimensional Gemini neural embeddings with natural-boundary sliding-window document chunking.
>
> Finally, I treated security and quality as first-class citizens: I implemented atomic refresh token rotation, Helmet security headers, strict Zod schema validation on every route, path-traversal security guards, and isolated rate limiting on login. The entire test suite runs in-process with Supertest, hitting 85% line coverage on Node 20. When load-tested with Autocannon against the local agent loop with the demo provider (isolating server overhead from upstream Gemini latency), it handles over 7,100 requests per second with a 1-millisecond p50 and 2-millisecond p95 latency.
>
> The codebase has an interactive Swagger UI at `/api/docs`, is containerized with Docker, and is ready for Google Cloud Run."

---

## 3. Ten Technical Interview Questions & Honest Answers

### Q1: "Why did you choose a brute-force cosine similarity scan over an Approximate Nearest Neighbor (ANN) index like HNSW or a dedicated vector database like Pinecone or Milvus?"
**Your Answer:**
> "I chose in-process cosine similarity deliberately based on the data scale. Lavoro is a personal and team productivity assistant where an active workspace typically indexes dozens to a few thousand document chunks—not millions.
> 
> At this scale (<50,000 vectors), an in-memory dot product scan over 3,072-dimensional vectors takes less than 3 to 5 milliseconds in Node.js. Adding an external vector database like Pinecone or Qdrant would have introduced 20 to 50 milliseconds of network round-trip latency, an external SaaS failure point, network serialization overhead, and recurring operational cost for zero user-perceptible benefit.
>
> Cosine similarity scan provides 100% exact recall (zero approximation error) with zero external infrastructure. In my README, I explicitly document this as an intentional trade-off: if the dataset were to exceed hundreds of thousands of vectors, I would migrate to `sqlite-vss` or pgvector with HNSW indexing."

---

### Q2: "What happens to in-flight background jobs if the process restarts or crashes?"
**Your Answer:**
> "In Phase 3, I migrated the job queue service from an ephemeral in-memory Map to our SQLite persistence layer. When a job is submitted via `POST /api/jobs`, it is immediately written to the `jobs` table with a status of `'queued'`.
>
> If the process crashes while a job is in `'running'` or `'queued'` state, on startup the system inspects the SQLite database. Jobs that were interrupted remain preserved with their parameters and timestamps.
>
> For a multi-node production deployment, I would implement a heartbeating or lease-expiration mechanism: if a job remains in `'running'` for longer than a timeout window without updating its heartbeat, a worker reclaims it and retries up to a max-retry limit before marking it as `'failed'` with a dead-letter record."

---

### Q3: "How do you revoke a refresh token and prevent replay attacks?"
**Your Answer:**
> "I use **Atomic Single-Use Refresh Token Rotation**.
>
> Every refresh token is issued with a unique JWT identifier (`jti` claim) and stored in the `refresh_tokens` SQLite table with an expiration timestamp and a `revoked_at` column.
>
> When a client calls `POST /api/auth/refresh`:
> 1. The server validates the token signature using the secret.
> 2. It queries the database for that token's `jti`.
> 3. If the token is already revoked or missing, the request is rejected immediately with HTTP 401.
> 4. If valid, inside an atomic transaction, the old token is marked as `revoked_at = NOW()`, and a brand new refresh token and access token pair is issued.
>
> Furthermore, if an old already-revoked refresh token is ever presented again, it triggers token-reuse detection, allowing us to revoke the entire session tree for that user because it indicates a compromised token."

---

### Q4: "Walk me through what happens if the Gemini API call times out or fails."
**Your Answer:**
> "The orchestrator has three layers of fault tolerance:
> 
> 1. **Model Fallback Cascade**: If the primary model (`gemini-3-flash-preview`) fails or is throttled (e.g. HTTP 429 or 503), the Gemini provider catches the exception and immediately retries with fallback model names (like `gemini-3.1-flash-lite`).
> 2. **Provider Failover**: If the external Gemini API is unreachable, times out, or if `GEMINI_API_KEY` is not configured, `AIOrchestrator` catches the provider exception and transparently fails over to `DemoProvider`.
> 3. **Structured Graceful Degradation**: `DemoProvider` executes the exact same function-calling ReAct loop locally, matching domain intent and executing real workspace tools, while synthesizing a deterministic fallback summary. The client receives a clean HTTP 200 response with audit metadata indicating `{ model: 'demo' }`, rather than an unhandled 500 error."

---

### Q5: "Why did you choose SQLite with WAL mode over PostgreSQL or MongoDB for this service?"
**Your Answer:**
> "I wanted the application to be completely self-contained, highly performant, and trivial to demo live or run in CI without spinning up Docker Compose or external database containers.
>
> SQLite via `better-sqlite3` runs directly in-process—queries execute via synchronous C++ bindings without network loopback latency. Enabling **Write-Ahead Logging (WAL)** allows concurrent readers to read without blocking writers, and writers to commit transactions without blocking readers.
>
> To ensure production readiness, I implemented the database layer with an abstraction layer: `DATABASE_URL` supports SQLite (`sqlite://./data/lavoro.db`) while keeping schema migrations cleanly separated in `src/db/migrate.js`. If deployed to Kubernetes or AWS with multiple stateless containers, the repository layer is already architected to connect to PostgreSQL via `pg` or Prisma by changing the connection string."

---

### Q6: "How does your agent loop prevent infinite loops or runaway LLM execution costs?"
**Your Answer:**
> "Runaway execution is a critical risk with tool-calling agents. I prevent it with three mechanisms:
> 
> 1. **Hard Iteration Cap**: `AIOrchestrator` enforces a `maxIterations` cap (default: 4 iterations). If the model keeps requesting tool calls without producing a final answer, the loop halts on iteration 4 and forces a final answer synthesis.
> 2. **Deduplication & State Diffing**: Tool execution results are fed back into the conversation context with unique role `'function'` or `'tool'` messages, allowing the model to see that the action succeeded.
> 3. **Validation & Error Bounding**: If a tool throws an error (e.g. invalid task argument), the error is caught and formatted as `{ success: false, error: message }` rather than crashing the loop, allowing the model to observe the failure and correct itself in the next turn."

---

### Q7: "How do you prevent path traversal attacks in the workspace project scanner?"
**Your Answer:**
> "In `backend/src/utils/projectScanner.js`, all path resolution flows through `resolveSafePath(rootDir, relativePath)`.
>
> 1. It computes `path.resolve(rootDir, relativePath)`.
> 2. It normalizes `rootDir` with `path.resolve(rootDir)`.
> 3. It checks that `safePath.startsWith(normalizedRoot + path.sep)`.
> 4. If someone attempts `../../etc/passwd`, `../../../etc/shadow`, or `/etc/passwd`, the condition fails and throws an error with HTTP status 400 (`Path traversal is not allowed`).
>
> In Phase 5, I authored explicit security tests in `tests/unit/projectScanner.test.js` and `tests/unit/security.test.js` that pass known directory traversal vectors and assert that HTTP 400 is thrown."

---

### Q8: "Why did you convert your tests to in-process Supertest rather than testing against a live server port?"
**Your Answer:**
> "Testing against a live HTTP server (`http://localhost:10000`) creates several real-world failure modes in CI and local development:
> - **Port Collisions**: If port 10000 is already bound, tests fail before running.
> - **Race Conditions**: Tests need arbitrary `sleep` timers or polling loops to wait for the HTTP listener to start.
> - **Process Teardown Leaks**: If a test crashes, the detached server process remains orphan-running in the background.
>
> Supertest invokes the Express `app` callback directly in-process via Node's internal HTTP stream abstraction. It executes the exact same middleware pipeline, routing, authentication, and error handling, but runs synchronously, takes 0 milliseconds to start, never conflicts on ports, and executes all 54 tests in under 1.5 seconds."

---

### Q9: "How does Server-Sent Events (SSE) streaming handle tool execution before text chunks?"
**Your Answer:**
> "In an agentic workflow with function calling, the loop must execute tools and observe results before any final answer can be synthesized. In Lavoro, `POST /api/ai/stream` implements **chunked delivery for UI/UX pacing, not token-level model streaming**.
>
> In `POST /api/ai/stream`:
> 1. The orchestrator runs the ReAct tool loop to completion, resolving tool calls, executing actions in the workspace, and obtaining observations.
> 2. The async generator dispatches tool execution events first:
>    `{ type: 'tool', tool: 'createTask', message: 'Created task: ...' }`
> 3. The client frontend catches these events and renders interactive tool cards immediately.
> 4. Once tool execution and model synthesis are complete, the server splits the final text into ~60-character pieces and yields them over SSE. This provides smooth UI/UX pacing and typewriter rendering in the browser rather than dumping a wall of text all at once.
> 5. When delivery finishes, it emits `{ type: 'done', latencyMs: ... }`.
>
> I wrote a unit test in `tests/unit/agentLoop.test.js` asserting that the `tool` event index is strictly less than the first `chunk` event index. Being precise here is important: it is intentional chunked delivery for UI/UX pacing, isolating tool execution from text display, with true token-level streaming on the final synthesis turn reserved for future enhancement."

---

### Q10: "How does your request validation differ from typical Express applications?"
**Your Answer:**
> "Many Express applications rely on ad-hoc manual validation inside route handlers or loose regex checks—which lead to prototype pollution, unexpected `undefined` exceptions, and unhandled edge cases.
>
> In Lavoro, I removed ad-hoc sanitization and centralized all request contracts into declarative **Zod schemas** (`schemas.js`). I built a reusable `validateBody(schema)` middleware:
> - If the request contains invalid types, missing required fields, or out-of-range strings, it rejects early with HTTP 400 and returns a structured array of `{ field, message }` errors.
> - On success, it replaces `req.body` with Zod’s parsed output (`result.data`), stripping any unapproved properties.
> - This guarantees that downstream route handlers and database queries only ever receive sanitized, type-safe data."
