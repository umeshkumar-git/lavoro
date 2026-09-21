# Lavoro Agent Evaluation Benchmark (EVALS.md)

This document records the automated, deterministic evaluation benchmark for Lavoro's AI agent loop.

## Benchmark Summary
- **Execution Date**: 2026-09-21
- **Provider Evaluated**: Deterministic Provider (`DemoProvider`)
- **Total Test Cases**: 18
- **Passed**: 18
- **Failed**: 0
- **Accuracy**: **100.0%**

## Methodology
The evaluation evaluates the agent's ability to:
1. **Plan & Select Tools**: Accurately predict whether an incoming user prompt requires tool invocation (`createTask`, `addReminder`, `createDailyPlan`, `searchProject`, `queryDocuments`) or pure conversational response (`none`).
2. **Avoid False Positives**: Not triggering mutations on general queries, knowledge inquiries, or drafting requests.
3. **Execute Deterministically**: Execute the agent loop end-to-end within standard response time limits.

---

## Detailed Results Table

| ID | Category | Prompt | Expected Tool | Predicted Tool | Status | Latency |
|:---|:---|:---|:---|:---|:---:|:---|
| TC-01 | Task Management | "Add a task to review the Q4 financial report tomorrow" | `createTask` | `createTask` | ✅ PASS | 2ms |
| TC-02 | Task Management | "Create a task: Refactor dashboard CSS with high priority" | `createTask` | `createTask` | ✅ PASS | 1ms |
| TC-03 | Task Management | "Add to-do: Update dependencies in package.json" | `createTask` | `createTask` | ✅ PASS | 0ms |
| TC-04 | Task Management | "Put 'Deploy to staging' on my task list with high priority" | `createTask` | `createTask` | ✅ PASS | 0ms |
| TC-05 | Reminders | "Remind me to take medication at 8 PM tonight" | `addReminder` | `addReminder` | ✅ PASS | 1ms |
| TC-06 | Reminders | "Set a reminder for the design sync at 3pm" | `addReminder` | `addReminder` | ✅ PASS | 0ms |
| TC-07 | Reminders | "Remind me tomorrow at 9am to check unread email" | `addReminder` | `addReminder` | ✅ PASS | 0ms |
| TC-08 | Reminders | "Don't let me forget to call mom at 6pm" | `addReminder` | `addReminder` | ✅ PASS | 0ms |
| TC-09 | Day Planning | "Plan my day around my meetings and high priority tasks" | `createDailyPlan` | `createDailyPlan` | ✅ PASS | 1ms |
| TC-10 | Day Planning | "Build a schedule for my afternoon focus block" | `createDailyPlan` | `createDailyPlan` | ✅ PASS | 0ms |
| TC-11 | Day Planning | "Create a daily plan for tomorrow morning" | `createDailyPlan` | `createDailyPlan` | ✅ PASS | 0ms |
| TC-12 | Codebase Search | "Search the codebase for authentication middleware" | `searchProject` | `searchProject` | ✅ PASS | 19ms |
| TC-13 | Codebase Search | "Find references to Redis in our repository" | `searchProject` | `searchProject` | ✅ PASS | 8ms |
| TC-14 | Knowledge Retrieval | "Find any documents about our cloud deployment architecture" | `queryDocuments` | `queryDocuments` | ✅ PASS | 1ms |
| TC-15 | Knowledge Retrieval | "Search our knowledge base for project onboarding notes" | `queryDocuments` | `queryDocuments` | ✅ PASS | 0ms |
| TC-16 | Conversational | "What is the capital of Italy?" | `none` | `none` | ✅ PASS | 0ms |
| TC-17 | Conversational | "Can you explain what the Eisenhower Matrix is?" | `none` | `none` | ✅ PASS | 0ms |
| TC-18 | Conversational | "Write a polite email asking a colleague for project status" | `none` | `none` | ✅ PASS | 0ms |

---

## Category Breakdown
- **Task Management**: 4/4 (100%)
- **Reminders**: 4/4 (100%)
- **Day Planning**: 3/3 (100%)
- **Codebase Search**: 2/2 (100%)
- **Knowledge Retrieval**: 2/2 (100%)
- **Conversational (No Tool)**: 3/3 (100%)

---

## Running the Benchmark
To re-run the evaluations and regenerate this report:
```bash
npm run eval
```
