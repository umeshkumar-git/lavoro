# Lavoro — AI Daily Assistant

An AI-powered assistant built on Node.js, Express, and Google's Gemini API. It started as a
5-day **Google AI Agents Intensive** capstone (a "concierge agent" for daily planning) and has
since grown into a small production-style backend: JWT auth, rate limiting, structured
logging/tracing, an in-memory RAG service, a background job simulator, mocked third-party
integrations — plus a persona-based prompting system that goes well beyond daily planning (see
[Backend Capabilities Not Yet in the UI](#backend-capabilities-built-but-not-yet-wired-to-the-ui)).

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](#)
[![Express](https://img.shields.io/badge/Express-5-black.svg)](#)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Pro-orange.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](#)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-lavoro.umeshshah.in-blueviolet.svg)](https://lavoro.umeshshah.in)

## Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [What Works End-to-End](#what-works-end-to-end-ui--api--gemini)
- [Backend Capabilities Built But Not Yet Wired to the UI](#backend-capabilities-built-but-not-yet-wired-to-the-ui)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Known Limitations & Trade-offs](#known-limitations--trade-offs)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

**Lavoro** (Italian for "work") is an Express backend + vanilla JS frontend that gives users a
conversational daily assistant — morning briefings, task prioritization, reminders, and a
structured daily plan — powered by Google's Gemini API, with a fully functional offline demo
mode when no API key is configured.

Underneath the daily-assistant surface, the backend has grown a second identity: a **persona
system** (`backend/src/ai/modes.js`) originally aimed at coding mentorship — Learn, Debug, Code
Review, Pair Programmer, Project Mentor, Interview Practice, and System Design — alongside the
Daily Planner persona that ships in the UI today. That mentor system is implemented and callable
through the API, but the current frontend only ever requests the Planner persona.

### Course Project Details

- **Course**: Google AI Agents Intensive
- **Duration**: 5 Days
- **Original topic**: Concierge Agents — Automate Daily Tasks and Improve Individual Workflows
- **Since then**: extended independently with auth, rate limiting, observability, RAG, a job
  queue, mocked integrations, and a multi-persona prompting layer

## Live Demo

A hosted instance is live at **[lavoro.umeshshah.in](https://lavoro.umeshshah.in)** — no
setup or signup required. If no `GEMINI_API_KEY` is configured on the deployment, it runs in
demo mode, which looks like this:

**Prompt:** "Give me my morning briefing"

```
Good morning! Here's your briefing for today:

Weather: 22°C, Partly Cloudy — clear skies expected

You have 4 events scheduled:
- 09:00 AM — Team Standup (30 min)
- 11:00 AM — Project Review (1 hour)
- 02:00 PM — Client Call (45 min)
- 04:00 PM — Code Review (30 min)

Important Emails: 1 high-priority message from manager@company.com
Priority Tasks: Complete project documentation (Due: Today)

Have a productive day!
```

<!-- Add a real screenshot or short GIF of the dashboard here, e.g.: -->
<!-- ![Lavoro dashboard](docs/screenshot.png) -->

## What Works End-to-End (UI ⇄ API ⇄ Gemini)

- **Morning Briefing / Email Summary / Prioritize Tasks / Plan My Day** — the four quick actions
  in the dashboard, each backed by a real API call
- **Streaming chat** (`POST /api/ai/stream`, Server-Sent Events) with the Daily Planner persona
- **Lightweight intent detection** on free-text chat messages — phrases like "remind me to…",
  "add task…", or "plan my day" are pattern-matched server-side and turned into real reminders/
  tasks/plans before the AI even responds (see `handleAssistantToolRequest` in `src/app.js`)
- **Session-scoped state**: profile, tasks, reminders, and plans, held in memory per session
- **Graceful demo mode**: with no `GEMINI_API_KEY` set, a `DemoProvider` serves realistic mock
  responses backed by mock calendar/email/task/weather data — the app is fully explorable with
  zero setup
- **Multi-model fallback**: if the configured Gemini model fails, the app automatically retries
  against a fallback list of models before dropping to demo mode
- **Dashboard summary** aggregating task/reminder/plan counts and current focus
- **Self-introspection API** (`/api/project/*`) — a sandboxed, path-traversal-safe file reader
  the assistant can use to answer questions about its own codebase
- **Health check** at `/api/health`

## Backend Capabilities Built But Not Yet Wired to the UI

These are implemented and reachable via the API, but not currently exposed anywhere in the
frontend. Listed here deliberately, instead of glossed over, because the honest gap is itself
useful context for anyone reading the code — and because closing it is the roadmap's top item.

- **7 additional AI personas** — Learn, Debug, Code Review, Pair Programmer, Project Mentor,
  Interview Practice, System Design (`ai/modes.js`). Each has its own prompt-construction rules
  and detection keywords. The frontend hardcodes `mode: "planner"` on every request, so these are
  currently only reachable by calling the API directly.
- **JWT authentication** with access/refresh token rotation (`/api/auth/*`) — implemented, but
  the middleware is only applied to `/api/auth/me`; the feature routes (dashboard, tasks, jobs,
  rag, integrations) don't require it yet, and they identify "the user" via an `x-session-id`
  header/IP rather than the authenticated JWT subject. Demo account passwords are currently
  stored in plaintext (`backend/src/repositories/userRepository.js`) — hashing them is a tracked
  fix, not an intentional design choice.
- **RAG service** (`/api/rag/index`, `/api/rag/query`) — in-memory documents with a hand-rolled
  bag-of-words embedding and cosine similarity. No persistence, no real embedding model or vector
  database yet; the interface is designed so either could be swapped in later.
- **Background job queue** (`/api/jobs`) — an in-process simulated queue (`Map` + `setTimeout`),
  not backed by a real broker (e.g. BullMQ/Redis-backed queue).
- **Mocked third-party integrations** (`/api/integrations/*`) — connector metadata and webhook
  plumbing for Google Calendar, Slack, and GitHub. No real OAuth handshake happens; `connect`
  simply records a fake connection.
- **Observability hooks** — Sentry (`@sentry/node`) and OpenTelemetry are wired into the config
  and error handler, but only activate when `SENTRY_DSN` / `OTEL_EXPORTER_OTLP_ENDPOINT` are set.

## Tech Stack

### Backend

- **Node.js 18+**, **Express 5**
- **Google Generative AI SDK** (`@google/generative-ai`) with a demo-mode fallback provider
- **jsonwebtoken** — access/refresh JWT auth
- **zod** — request schema validation (login, refresh, job payloads)
- **pino** — structured logging
- **@sentry/node** + **OpenTelemetry** — error tracking and tracing (opt-in via env vars)
- Hand-rolled per-IP sliding-window rate limiter (no external dependency)
- **cors** — origin allow-list with automatic localhost exemption

### Frontend

- Vanilla **HTML5 / CSS3 / JavaScript** — no framework, no build step
- **Fetch + Server-Sent Events** for streaming chat responses

### AI

- **Google Gemini** (configurable model with automatic fallback chain)
- Custom prompt-orchestration layer (`ai/orchestrator.js`, `ai/prompts.js`) with mode detection,
  trusted vs. untrusted context separation, and explicit anti-prompt-injection instructions in
  the system prompt

## Project Structure

```
lavoro/
│
├── backend/
│   ├── server.js                     # Entry point — starts the Express app
│   ├── src/
│   │   ├── app.js                    # Express app: middleware, routes, session-based endpoints
│   │   ├── ai/
│   │   │   ├── orchestrator.js       # Routes requests to Gemini or the demo provider, handles streaming + fallback
│   │   │   ├── providers.js          # GeminiProvider (real) and DemoProvider (offline mock)
│   │   │   ├── modes.js              # 8 AI personas: learn, debug, review, pair, project, interview, systemDesign, planner
│   │   │   ├── prompts.js            # System/developer prompt construction, trusted/untrusted context split
│   │   │   └── context.js            # Assembles per-request context for the orchestrator
│   │   ├── config/
│   │   │   ├── index.js              # Env-driven config, JWT secret handling, CORS allow-list
│   │   │   ├── logger.js             # Pino logger setup
│   │   │   └── telemetry.js          # Sentry + OpenTelemetry wiring
│   │   ├── data/store.js             # In-memory session store: profile, tasks, reminders, plans, conversation history
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verification + role-check middleware
│   │   │   └── rateLimit.js          # Per-IP sliding-window rate limiter
│   │   ├── repositories/userRepository.js  # In-memory demo user "database"
│   │   ├── routes/                   # /api/auth, /api/dashboard, /api/jobs, /api/rag, /api/integrations, /api/ai
│   │   ├── services/
│   │   │   ├── authService.js        # Login, token generation, refresh rotation
│   │   │   ├── dashboardService.js   # Aggregates session data into dashboard metrics
│   │   │   ├── executiveSummaryService.js  # Generates a productivity summary + score
│   │   │   ├── integrationService.js # Mocked OAuth connectors + webhook handling
│   │   │   ├── jobQueueService.js    # Simulated background job queue
│   │   │   └── ragService.js         # In-memory embeddings + cosine-similarity retrieval
│   │   ├── shared/
│   │   │   ├── constants.js          # User roles, auth scopes
│   │   │   └── schemas.js            # Zod request-validation schemas
│   │   ├── cache/redisCache.js       # In-memory cache behind a Redis-shaped interface
│   │   └── utils/projectScanner.js   # Sandboxed project file reader/search (path-traversal safe)
│   ├── utils/                        # Legacy Python prototype (`gemini_agent.py`, `mock_data.py`), kept for reference
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── index.html                    # Dashboard shell + quick actions + chat panel
│   ├── style.css
│   └── script.js                     # Quick actions, SSE chat client, dashboard rendering
│
├── tests/smoke.test.js               # Integration smoke tests (health, auth, dashboard, jobs, rag, integrations)
├── .github/workflows/ci.yml          # CI: installs deps, lints, runs tests (currently provisions Postgres + Redis
│                                       services that the app doesn't use yet — see Known Limitations)
├── Dockerfile / docker-compose.yml / cloudbuild.yaml / deploy.sh  # Container + Cloud Run deployment
└── README.md
```

## Installation

### Prerequisites

- **Node.js 18+** (CI runs on Node 20 — recommended if you're setting up fresh)
- **Google Gemini API key** (free tier at [Google AI Studio](https://aistudio.google.com/app/apikey)) — optional, the app runs in demo mode without one
- A modern browser

### Setup

```bash
git clone https://github.com/umeshkumar-git/lavoro.git
cd lavoro

cd backend
npm install
cp .env.example .env   # then fill in the values you want
```

Minimum useful `.env` for local development:

```
PORT=10000
GEMINI_API_KEY=your_gemini_api_key_here   # optional — omit to run in demo mode
GEMINI_MODEL=gemini-3-flash-preview
JWT_SECRET=some_long_random_string
```

Run it:

```bash
npm start
```

```
-----------------------------------------
Lavoro is running at http://localhost:10000
Health check: http://localhost:10000/api/health
-----------------------------------------
```

Open <http://localhost:10000>. Express serves the frontend and handles all `/api/*` requests
from the same origin.

## Testing

```bash
cd backend
npm test
```

Runs the integration smoke tests in `tests/smoke.test.js`, covering the health check, auth
flow, dashboard, jobs, RAG, and integrations endpoints. This is also what CI runs on every push.

## API Reference

All responses are JSON except `/api/ai/stream`, which is Server-Sent Events. `success: true/false`
is included on every JSON response.

| Method | Endpoint | Auth required today | Description |
|---|---|---|---|
| GET | `/api/health` | No | Service health, active model, and configuration summary |
| GET | `/api/ai/modes` | No | Lists all 8 AI personas and their descriptions |
| POST | `/api/ai/chat` | No | Non-streaming chat completion |
| POST | `/api/ai/stream` | No | Streaming chat completion (SSE); also runs the tool-intent detector |
| POST | `/api/ai/daily-summary` | No | Generates an executive summary + productivity score from tasks/notes/goals |
| GET/POST | `/api/profile` | No | Read/update the session's assistant profile |
| GET | `/api/conversations` | No | Session's conversation history |
| GET/POST | `/api/tasks` | No | Read/add tasks |
| GET/POST | `/api/reminders` | No | Read/add reminders |
| GET/POST | `/api/plans` | No | Read/create a structured daily plan |
| POST | `/api/reset` | No | Clears the session's conversation history |
| GET | `/api/project/structure`, `/file`, `/search` | No | Sandboxed read-only access to the repo, for the assistant's self-introspection feature |
| POST | `/api/auth/login` | No | Returns a JWT access/refresh token pair |
| POST | `/api/auth/refresh` | No | Rotates a refresh token for a new pair |
| GET | `/api/auth/me` | **Yes** | Returns the authenticated user (the only route currently gated) |
| GET | `/api/dashboard/summary` | No | Aggregated task/reminder/plan metrics for the session |
| POST | `/api/jobs` | No | Enqueues a simulated background job, returns `202` + job ID |
| GET | `/api/jobs/:jobId` | No | Polls a simulated job's status |
| POST | `/api/rag/index` | No | Indexes documents into the in-memory RAG store |
| POST | `/api/rag/query` | No | Retrieves the most relevant indexed documents for a query |
| GET | `/api/integrations/connectors` | No | Lists mocked OAuth connectors |
| POST | `/api/integrations/connect/:provider` | No | Records a mocked connection |
| POST | `/api/integrations/webhooks/:provider` | No | Accepts a mocked webhook payload |

**Example — chat:**

```json
// POST /api/ai/chat
{ "message": "Give me my morning briefing" }

// Response
{
  "success": true,
  "message": "Good morning! Here's your briefing for today...",
  "mode": "planner",
  "model": "gemini-3-flash-preview",
  "latencyMs": 812
}
```

**Example — login:**

```json
// POST /api/auth/login
{ "email": "user@example.com", "password": "Password123!" }

// Response
{
  "success": true,
  "user": { "id": "user-regular-1", "email": "user@example.com", "name": "Team Member", "role": "user" },
  "tokens": { "accessToken": "...", "refreshToken": "..." }
}
```

## Known Limitations & Trade-offs

Documented deliberately rather than discovered by a reviewer:

- **No persistence.** All data (users, sessions, tasks, RAG documents, jobs) lives in memory and
  resets on restart. The CI pipeline already provisions Postgres and Redis service containers in
  anticipation of a real data layer — that migration hasn't happened yet.
- **Auth is implemented but not enforced everywhere.** Only `/api/auth/me` currently requires a
  valid JWT; feature routes are open and keyed by IP/header rather than authenticated user ID.
- **Demo credentials are stored in plaintext**, not hashed — acceptable for throwaway seed
  accounts in a local demo, not acceptable as a pattern to reuse anywhere real.
- **RAG, job queue, and integrations are simulated**, not backed by a real vector store, message
  broker, or OAuth provider. They demonstrate the intended architecture and interface, not a
  production integration.
- **7 of 8 AI personas aren't reachable from the UI** — see above.

## Roadmap

**Highest priority (mostly frontend work on existing backend logic):**
- [ ] Expose a persona/mode switcher in the chat UI so Learn, Debug, Code Review, Pair
      Programmer, Project Mentor, Interview Practice, and System Design are actually usable
- [ ] Enforce `authenticate` on feature routes and key session data off `req.user.id` instead of IP/header
- [ ] Hash stored passwords with bcrypt

**Infrastructure:**
- [ ] Real Postgres-backed user store + Redis-backed cache (CI already expects both)
- [ ] Real embedding model + vector store for RAG
- [ ] Real background job broker (e.g. BullMQ)

**Product:**
- [ ] Real Calendar/Email/Task-manager integrations (Google Calendar, Gmail, Todoist/Asana)
- [ ] Voice input/output
- [ ] Multi-day conversation memory
- [ ] Analytics dashboard

## Contributing

Contributions, issues, and feature requests are welcome — see the [issues page](https://github.com/umeshkumar-git/lavoro/issues).

1. Fork the project
2. `git checkout -b feature/AmazingFeature`
3. Commit your changes with a clear message
4. `git push origin feature/AmazingFeature`
5. Open a Pull Request

## License

MIT — see [LICENSE](https://github.com/umeshkumar-git/lavoro/blob/main/LICENSE).

## Author

**Umesh Kumar** — [@umeshkumar-git](https://github.com/umeshkumar-git)
