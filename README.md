# PostPilot

A governed agentic AI system that plans and writes a week of social media posts for small businesses.
An orchestrator runs three AI subagents, hard-coded governance rules check every draft, and nothing
reaches the final calendar until the owner approves it.

**Stack:** MongoDB · Express · React (Vite) · Node.js · Claude API · NIST AI RMF

```
Owner brief ─► Orchestrator ─► Planner ─► Writer ─► Governance rules ─► Reviewer ─► Owner approval ─► Calendar
                     ▲                       ▲                                │
                     │                       └──── FAIL: revise (max 2) ◄─────┘
                     └── every step is written to the audit log (MongoDB + logs/audit-log.jsonl)
```

## Run it

You need **Node.js 20+** and **MongoDB** (local [Community Server](https://www.mongodb.com/try/download/community), Docker, or a free Atlas cluster).

```bash
npm run install:all                  # installs root, server and client
cp server/.env.example server/.env   # Windows: copy server\.env.example server\.env
npm run dev                          # API on :5000, app on http://localhost:5173
```

- **No API key?** Leave `ANTHROPIC_API_KEY` empty and the app uses mock agents. They give scripted
  replies built from your brief, so the whole flow works offline (useful as a demo-day backup).
- **With a key,** the three agents call Claude (`ANTHROPIC_MODEL`, default `claude-haiku-5-5`).
- **No MongoDB yet?** Set `DB_MODE=memory` in `server/.env` to try the app. Data is lost on restart.

Production: `npm run build` then `npm start`. Express serves the built React app on port 5000.

Tests: `npm test` runs the governance unit tests and the scenario tests (TC1–TC5, TC7) with mock agents.

## How it's built

| Part | File | What it does |
|---|---|---|
| Orchestrator (main agent) | `server/src/orchestrator.js` | Routes each slot Writer → Rules → Reviewer, loops failures back with the exact issues, stops after 2 revisions, marks every post `PENDING` |
| Agent 1: Content Planner | `server/src/agents/planner.js` + `skills/content-calendar-planning` | Turns the goal into day/time/theme/type slots |
| Agent 2: Content Writer | `server/src/agents/writer.js` + `skills/caption-writing` | Caption, hashtags, image idea; revises with feedback |
| Agent 3: Brand & Compliance Reviewer | `server/src/agents/reviewer.js` + `skills/post-review-checklist` | Returns PASS/FAIL with issues |
| Governance | `server/src/governance/rules.js` | Plain-code rules the model can't bypass |
| Approval gate | `server/src/routes/posts.js`, `GET /api/runs/:id/final` | Only owner-approved posts are returned |
| Audit log | `server/src/utils/logger.js` | MongoDB `auditevents` collection + JSONL file |
| Model wrapper | `server/src/utils/llm.js` | One `callLLM()`; validates JSON and retries once |

### API

| Route | Purpose |
|---|---|
| `POST /api/runs` | Validates the brief (400 if goal or prices are missing), starts the pipeline, returns `202` |
| `GET /api/runs` / `GET /api/runs/:id` | Plans list / one plan with live progress, posts and metrics |
| `GET /api/runs/:id/events` | Audit log for one plan |
| `GET /api/runs/:id/final` | **Approved posts only** (the gate) |
| `PATCH /api/posts/:id/decision` | `{ decision, caption?, acknowledgeIssues? }`. Edits are re-checked; approving a caption that still breaks a rule returns `409` unless acknowledged, and the override is logged |
| `POST /api/posts/check` | Live rule check while the owner edits |

### Governance rules

| # | Rule | Enforced by |
|---|---|---|
| 0 | Brief is pre-screened for prompt injection, politics and personal data | `prescreenBrief()` |
| 1 | Prices and promos must match the owner's input exactly | `rules.js` + Reviewer |
| 2 | No "best", "No. 1", health or guarantee claims | `banned-words.txt` + Reviewer |
| 3 | No customer personal data | regex in `rules.js` |
| 4 | Captions stay within 150 words | `rules.js` |
| 5 | No post reaches the final output without owner approval | `GET /api/runs/:id/final` |
| 6 | Image ideas are descriptions only | skill rules |
| 7 | Every AI action and human decision is logged | `logger.js` |

### Fixes compared with the original plan

- Rule 1 allows amounts written in the promo, so "₱20 off" no longer fails the normal test case.
- Prices with commas or decimals (₱1,299, ₱99.50) are read correctly.
- Phone numbers with spaces ("0917 123 4567") are caught.
- Banned words match whole words only ("secures" no longer trips "cures").
- Owner edits are re-checked by the rules before approval; overrides are logged.
- Each post keeps its revision trail, and each issue says whether a rule or the Reviewer caught it.
- AI text is rendered by React (escaped), never with `innerHTML`.
- `callLLM()` validates the JSON shape and retries once instead of crashing the run.
- Every plan is its own MongoDB document, so a new run never wipes a batch under review.
