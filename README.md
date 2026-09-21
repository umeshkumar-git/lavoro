# Lavoro - AI-Powered Personal Daily Assistant & Productivity Platform

Lavoro is an intelligent, full-stack AI productivity platform that combines conversational agent capabilities, daily executive briefings, task management, retrieval-augmented generation (RAG), and telemetry into a production-grade Node.js service.

![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![Express](https://img.shields.io/badge/Express-5.x-black.svg)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Pro%20%2F%20Flash-orange.svg)
![Supertest](https://img.shields.io/badge/Tests-In--Process%20Supertest-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Core Features](#core-features)
- [Authentication & Security](#authentication--security)
  - [Bcrypt Password Hashing](#bcrypt-password-hashing)
  - [JWT Access & Refresh Rotation](#jwt-access--refresh-rotation)
  - [Architectural Limitation: In-Memory Token Scope](#architectural-limitation-in-memory-token-scope)
  - [Demo Account Seeding](#demo-account-seeding)
- [Observability & Telemetry](#observability--telemetry)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Seeding](#installation--seeding)
  - [Running Locally](#running-locally)
- [Testing & Quality Checks](#testing--quality-checks)
- [CI/CD Pipeline](#cicd-pipeline)
- [Roadmap](#roadmap)
- [License](#license)

---

## Architecture Overview

Lavoro is structured around a decoupled, modular Express 5 backend that serves both an API and a high-performance static frontend shell:

- **AI Orchestration**: Built-in multi-mode orchestrator supporting streaming responses (SSE) with Gemini 3 Flash / Flash Lite, native function calling, and resilient fallbacks.
- **Persistence Layer**: Embedded SQLite database via `better-sqlite3` with WAL mode, automated SQL migrations, restart survival, and honest in-memory fallback.
- **Security & RBAC**: Stateless JWT access tokens with refresh token rotation and bcrypt-hashed credentials.
- **Performance Caching**: Tiered in-memory / Redis cache for fast metric and dashboard aggregation.
- **Observability**: Distributed tracing via OpenTelemetry, real-time error capture via Sentry, and high-throughput structured logging with Pino.
- **Asynchronous Processing**: Background job ingestion for asynchronous summaries and report generation.

---

## Repository Structure

```
lavoro/
├── backend/
│   ├── server.js               # Server bootstrap & HTTP listener
│   ├── scripts/
│   │   └── seed.js             # Local-dev demo account seeding
│   └── src/
│       ├── app.js              # Express app definition, middleware, static hosting
│       ├── ai/
│       │   ├── context.js      # Context window builder & session summarization
│       │   ├── modes.js        # Productivity modes (assistant, briefing, planner, tasks, email, summary)
│       │   ├── orchestrator.js # Iterative function-calling agent loop
│       │   ├── prompts.js      # System prompt templates
│       │   ├── providers.js    # Gemini SDK provider & mock DemoProvider
│       │   └── tools.js        # Gemini function-calling JSON schemas & tool execution
│       ├── cache/
│       │   └── redisCache.js   # Cache interface with TTL support
│       ├── config/
│       │   ├── index.js        # Environment validation & central config
│       │   ├── logger.js       # Pino structured logger
│       │   └── telemetry.js    # OpenTelemetry SDK and Sentry initialization
│       ├── data/
│       │   └── store.js        # Session store with SQLite persistence & memory fallback
│       ├── db/
│       │   ├── index.js        # SQLite connection manager with WAL mode
│       │   ├── migrate.js      # Automated migration runner
│       │   └── migrations/     # Versioned SQL migrations (001 - 004)
│       ├── middleware/
│       │   ├── auth.js         # Bearer JWT verification & role authorization
│       │   └── rateLimit.js    # Sliding window rate limiter
│       ├── repositories/
│       │   └── userRepository.js # User store with SQLite persistence & bcrypt hashing
│       ├── routes/
│       │   ├── aiRoutes.js          # AI daily summary and mode endpoints
│       │   ├── authRoutes.js        # Login, refresh token rotation, and /me
│       │   ├── dashboardRoutes.js   # Aggregated productivity metrics
│       │   ├── index.js             # Centralized route registration
│       │   ├── integrationRoutes.js # Connector listings & Slack webhook ingestion
│       │   ├── jobsRoutes.js        # Async job queue management
│       │   └── ragRoutes.js         # Knowledge base document indexing and search
│       ├── services/
│       │   ├── authService.js      # Authentication, token pairs, and session lifecycle
│       │   ├── dashboardService.js # Metric calculations and cache coordination
│       │   ├── jobQueueService.js  # Async background job queue with SQLite persistence
│       │   └── ragService.js       # RAG embeddings and retrieval with SQLite persistence
│       ├── shared/
│       │   ├── constants.js    # User roles and system constants
│       │   └── schemas.js      # Zod validation schemas
│       └── utils/
│           └── projectScanner.js # Local repository introspection tool
├── frontend/
│   ├── index.html              # Responsive app shell & interactive dashboard
│   ├── script.js               # Frontend controller, state management, SSE handling
│   └── style.css               # Modern styling, animations, and dark theme
├── scripts/
│   ├── eval-agent.js           # 18-prompt deterministic agent evaluation benchmark
│   └── seed.js                 # Standalone demo seeding script
├── tests/
│   ├── persistence.test.js     # SQLite persistence, restart survival, & fallback tests
│   └── smoke.test.js           # In-process integration tests with Supertest
└── .github/
    └── workflows/
        └── ci.yml              # Streamlined CI workflow (lint & in-process tests)
```

---

## Core Features

1. **Streaming Chat & Productivity Modes**:
   - Natural language interaction with streaming server-sent events (`/api/ai/stream`).
   - Six specialized productivity modes:
     - `assistant` (Default): General executive concierge for queries, notes, and day management.
     - `briefing`: Comprehensive morning briefing (weather, scheduled meetings, urgent emails, top tasks).
     - `planner`: Time-blocked schedule construction with dedicated deep-work blocks.
     - `tasks`: Eisenhower Matrix task prioritization, breakdown, and next actions.
     - `email`: Inbox triage, urgency ranking, and draft response generation.
     - `summary`: End-of-day executive retrospectives and automated productivity scoring.
   - Graceful fallback: works out-of-the-box in demo mode with rich productivity data even without an API key.

2. **Executive Daily Summaries**:
   - Automated productivity scoring (0-100) and actionable daily summaries from tasks, notes, and goals.

3. **Knowledge Base & Retrieval (RAG)**:
   - Index documents and context in-memory with `/api/rag/index`.
   - Query indexed context with `/api/rag/query` to ground assistant responses.

4. **Background Job Queue**:
   - Accept asynchronous tasks (`daily-summary`, `email-digest`, `report-generation`) returning `202 Accepted` and tracking IDs.

5. **Third-Party Integrations**:
   - Connector registry and webhook handlers for external event ingestion (e.g. Slack).

---

## Authentication & Security

### Bcrypt Password Hashing
Passwords are never stored in plaintext. Passwords are salted and hashed using `bcrypt` (10 rounds) during user creation in [userRepository.js](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/backend/src/repositories/userRepository.js). Login authentication performs constant-time comparison via `bcrypt.compare`.

### JWT Access & Refresh Rotation
- **Access Tokens**: Signed with `JWT_SECRET` with short TTL (default: 15 minutes).
- **Refresh Tokens**: Cryptographically signed tokens with longer TTL (default: 7 days) used to issue new token pairs at `/api/auth/refresh`.
- **Role-Based Access**: Granular roles (`admin`, `manager`, `user`) supported in authorization middleware.

### Architectural Limitation: In-Memory Token Scope
> [!WARNING]
> **Single-Instance / Local-Dev Scope**: Refresh tokens currently live in an in-memory Map (`refreshTokens` in [authService.js](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/backend/src/services/authService.js)).
> - **Volatility**: Tokens vanish upon server restart or process crashes.
> - **Horizontal Scaling**: Multi-instance deployments cannot validate tokens issued by peer instances without sticky sessions or a shared persistence layer.
>
> **Roadmap to Persistence**: In a multi-instance production environment, this in-memory Map will be migrated to Redis with TTL expiration or PostgreSQL token tables with explicit revocation lists.

### Demo Account Seeding
Demo accounts are managed via [scripts/seed.js](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/scripts/seed.js) and are **strictly prohibited** in production:
- Automatically runs when `NODE_ENV !== 'production'`.
- Aborts immediately if `NODE_ENV === 'production'`.
- Uses a clearly identifiable dev credential:
  - **Email**: `admin@example.com` (also `manager@example.com`, `user@example.com`)
  - **Password**: `dev-seed-password-do-not-use-in-prod` (overridable via `DEV_SEED_PASSWORD`)

---

## Observability & Telemetry

Lavoro integrates production-grade observability out of the box:
- **OpenTelemetry**: Configured in [telemetry.js](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/backend/src/config/telemetry.js). Automatically instruments incoming HTTP requests and exports traces when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured.
- **Sentry**: Captures unhandled exceptions and request contexts when `SENTRY_DSN` is set.
- **Pino**: Structured, high-performance JSON logging for all incoming requests and system events.

---

## API Reference

### Authentication
- `POST /api/auth/login` — Authenticate user and receive `{ accessToken, refreshToken, user }`.
- `POST /api/auth/refresh` — Rotate refresh token and receive a fresh token pair.
- `GET /api/auth/me` — Retrieve current authenticated user profile (requires `Authorization: Bearer <token>`).

### AI & Assistant
- `POST /api/ai/chat` — Send a message and get an aggregated AI response.
- `POST /api/ai/stream` — Real-time Server-Sent Events (SSE) streaming chat.
- `GET /api/ai/modes` — List available assistant modes.
- `POST /api/ai/daily-summary` — Generate an executive summary and productivity score.

### Dashboard & Analytics
- `GET /api/dashboard/summary` — Cached summary metrics (task counts, completion rates, priorities).

### Knowledge & RAG
- `POST /api/rag/index` — Ingest and index documents.
- `POST /api/rag/query` — Retrieve relevant documents for a query.

### Jobs & Integrations
- `POST /api/jobs` — Enqueue an asynchronous background job.
- `GET /api/jobs/:id` — Query status of a background job.
- `GET /api/integrations/connectors` — List active third-party integrations.
- `POST /api/integrations/webhooks/:provider` — Ingest webhooks (e.g. Slack).

### System
- `GET /api/health` — Service health check, model configuration, and backend status.

---

## Getting Started

### Prerequisites
- **Node.js**: version 20 or higher recommended (minimum Node.js 18+)
- **Google Gemini API Key** (optional): Free from [Google AI Studio](https://aistudio.google.com/app/apikey). If not set, Lavoro automatically falls back to simulated demo responses.

### Installation & Seeding

1. **Clone the repository**:
   ```bash
   git clone https://github.com/umeshkumar-git/lavoro.git
   cd lavoro
   ```

2. **Install root and backend dependencies**:
   ```bash
   npm install
   npm --prefix backend install
   ```

3. **Configure environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` to configure your `GEMINI_API_KEY`, `JWT_SECRET`, etc.

4. **Seed local demo accounts (optional, runs automatically in non-production)**:
   ```bash
   npm run seed
   ```

### Running Locally

```bash
# Start backend server and static frontend (default port: 10000)
npm run dev
```

Open [http://localhost:10000](http://localhost:10000) in your browser.

---

## Testing & Quality Checks

Tests run completely **in-process** via [supertest](https://github.com/ladjs/supertest) and Node's native test runner (`node:test`). No live server, external database, or open port is required:

```bash
# Run in-process smoke and integration tests
npm test

# Run syntax and lint checks
npm run lint
```

---

## CI/CD Pipeline

The GitHub Actions workflow at [.github/workflows/ci.yml](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/.github/workflows/ci.yml) executes on every push and pull request across `main`, `master`, and `develop`:
1. Checks out repository.
2. Configures Node.js 20 with npm caching.
3. Installs clean dependencies via `npm ci` and `npm --prefix backend ci`.
4. Runs lint checks via `npm run lint`.
5. Executes the full integration suite in-process via `npm test`.

---

## Roadmap

- **Phase 1**: Frontend polish, conversational streaming UI improvements, and responsive quick-action panels.
- **Phase 2**: Expanded connector ecosystem (Google Calendar, Outlook, Jira).
- **Phase 3**: Persistent database migration (PostgreSQL user store, Redis distributed cache, persistent refresh token revocation lists).
- **Phase 4**: Advanced multi-tenant RBAC and fine-grained API token management.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](file:///Users/umeshshah/Umesh%20Stuff/daily-assistant/LICENSE) file for details.
