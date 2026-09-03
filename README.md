# Vasooli

**AI-powered revenue recovery for failed payments & abandoned checkouts.**
Built for the Razorpay AI Buildathon — Track 03: AI Revenue Recovery.

Vasooli watches a stream of failed/abandoned Indian fintech transactions. For every one, a **real LLM** (Gemini, with NVIDIA NIM supported as an alternative) **diagnoses why it failed** and **recommends a recovery action** — but that recommendation is never executed blindly. A separate, plain-code **policy engine** validates or overrides it against hard compliance limits (max 3 attempts, no spam, capped discounts) before anything is simulated and logged. Every diagnosis, AI recommendation, policy decision, message, and outcome is written to a structured audit trail. An automated **eval suite** re-checks that trail after every run — live, wired into the running server, not a separate offline script — to mechanically prove the guardrails actually held. A **live "try to break a guardrail" demo** lets you feed the real policy engine a deliberately unsafe AI proposal and watch it get caught in real time.

---

## Problem statement

Failed payments and abandoned checkouts are one of the largest silent revenue leaks in Indian fintech/e-commerce — card declines, OTP timeouts, insufficient funds, and flaky bank/network infra routinely kill 10-20% of transaction volume. Most of that revenue is recoverable with the right nudge at the right time, but doing it well requires:

1. Correctly diagnosing *why* a payment failed (not all failures are equal).
2. Choosing a recovery action that matches the failure — not spamming everyone with the same discount.
3. Knowing when **not** to act, and when to stop and hand off to a human.
4. Being fully auditable — every automated customer-facing action needs a paper trail, and the safety limits need to hold *even if the AI proposes something unsafe*.

Vasooli is a working, end-to-end system that does all four — and it doesn't just claim to; the dashboard shows it happening on every page.

---

## What I built

| Layer | What it does |
|---|---|
| **Synthetic dataset** | 92 realistic Indian fintech transaction records (UPI/card/netbanking failures, subscription + one-off payments) — `server/data/transactions.json` / `.csv` |
| **LLM agent** | Calls Gemini (or NVIDIA NIM) per attempt to diagnose root cause + severity, recommend an action, and draft the Hinglish message — `server/src/llmAgent.js`, `server/src/llmClient.js`, `server/src/geminiClient.js` |
| **Independent key/quota per role** | The transaction pipeline and the chatbot assistant can run on two separate Gemini keys/models, so a busy pipeline run never starves the chatbot's quota — `GEMINI_API_KEY_ASSISTANT` in `.env.example` |
| **Policy engine** | Plain, deterministic code that validates/overrides the AI's recommendation against hard limits — never delegated to the model — `server/src/policy.js` |
| **Rule-based fallback engine** | If the LLM is unavailable or misbehaves, the same attempt falls back to a fully deterministic classifier + decision table, so the pipeline never stalls — `server/src/classify.js`, `server/src/decide.js`, `server/src/message.js` |
| **Simulation layer** | Probabilistic (not random) outcome model grounded in action/root-cause/attempt-number — `server/src/simulate.js` |
| **Audit trail** | Every AI diagnosis, AI recommendation, policy decision (incl. overrides), message, and outcome, for every attempt, written to JSON + CSV — `server/audit/audit_log.json` |
| **Live guardrail evals** | An automated 11-check suite re-verifies the audit trail after every pipeline run — wired directly into the running server (`GET /api/evals`), not a disconnected CLI script, so the dashboard renders the real result, not a hardcoded claim — `server/src/evals.js` |
| **Guardrail stress test** | An interactive endpoint + UI that feeds the real `enforcePolicy()` function synthetic "the AI proposed something unsafe" scenarios and shows the live override — `server/src/guardrailDemo.js`, `POST /api/guardrail-stress-test` |
| **Chatbot assistant** | A tool-calling assistant that answers questions about the live run by picking one of four tools, executing it against real in-memory state, and answering only from that result — never from the full dataset in-prompt — `server/src/assistant.js` |
| **REST API** | Serves metrics, case list (filterable), per-case audit detail, live guardrail evals, guardrail stress-test scenarios, and CSV exports — `server/src/server.js` |
| **React dashboard** | Fintech-ops-style console: KPIs, charts, searchable audit log, per-case drill-down showing AI vs. rule-engine source and any policy override, plus a landing page that shows the real severity-scoring formula, the real decision playbook, and a real generated customer message — `client/` |

---

## Architecture

```mermaid
flowchart LR
    subgraph Data
        A[Synthetic Dataset\ntransactions.json/csv]
    end

    subgraph "Agent Pipeline (per attempt)"
        B[LLM Agent\nGemini / NVIDIA NIM\ndiagnose + recommend + draft message]
        B2[Rule-Engine Fallback\nif LLM unavailable/fails]
        C[Policy Engine\nvalidate/override:\nmax 3 attempts, no-repeat,\ndiscount caps]
        D[Simulate Execution\nprobabilistic outcome model]
        F{Recovered?}
    end

    subgraph Persistence
        G[(Audit Trail\naudit_log.json/csv)]
        H[(Case Summaries)]
        I[(Metrics)]
        L[(Eval Report\nguardrail checks)]
    end

    subgraph Serving
        J[REST API\nExpress]
        K[React Dashboard]
        M[Chatbot Assistant\ntool-calling over live state]
    end

    A --> B
    B -- "on failure" --> B2
    B --> C
    B2 --> C
    C --> D --> F
    F -- No, attempts left --> B
    F -- Yes / Escalate / No-Action --> G
    G --> H --> I
    G --> L
    H --> J
    I --> J
    L --> J
    J --> K
    J --> M
```

Every transaction runs through a **bounded agent loop**, attempt by attempt: the LLM (or its rule-based fallback) proposes a diagnosis + action + message → the policy engine approves or overrides it → the action is simulated → the loop continues only while attempts remain and the last action wasn't terminal (escalate / no-action). Each iteration is one audit entry, so a single transaction can produce 1-3 entries — the full negotiation, not just the final outcome.

---

## Why the AI doesn't hold the safety limits

The buildathon brief explicitly calls for "**compliant escalation processes and stopping rules**" and "**bounded workflows with appropriate safeguards**." An LLM can be prompted to respect limits, but prompts are not guarantees — models drift, hallucinate, or occasionally ignore instructions. So the split here is deliberate:

- The **LLM's job** is judgment: diagnosing an ambiguous failure reason, weighing severity, choosing the most natural next lever, writing a message that doesn't sound robotic.
- The **policy engine's job** (`policy.js`) is arithmetic: attempt counts, repeat-action checks, discount floors/caps. It re-validates *every* proposal — from the LLM or the fallback engine — and silently substitutes a safe action when a proposal would violate a rule, logging exactly why.

Concretely, `policy.js` enforces:
- **Max 3 recovery attempts per customer** — hard stop, forces escalation regardless of what was proposed.
- **No repeated identical action back-to-back** — a different lever is substituted automatically.
- **Discounts are capped at 15%, gated above a ₹500 floor, and offered at most once per case.**
- **Unrecognized/malformed model output** is treated as a policy violation and routed to human escalation rather than executed.
- **Low-value, likely self-resolving cases** don't get a discount or escalation on the first attempt — the agent can (and does) choose `no_action_needed`, logged with reasoning, not silently skipped. This is the **false-action rate** metric.

See `TXN20260800054` in the audit log for a case that hits all 3 attempts and is closed gracefully rather than looped forever, and search the audit log for `"overridden_by_policy": true` to see the policy engine actively correcting an AI proposal.

**Don't want to dig through the audit log?** Open the Architecture page in the dashboard and use the **"Try to break a guardrail"** widget — pick a way the AI might misbehave (repeat itself, blow past the attempt cap, invent an action, offer an oversized discount) and watch the real `enforcePolicy()` function catch it, live, on that request.

---

## Guardrails are proven, not just claimed

After every pipeline run — including the one the server runs automatically on boot, and every re-run triggered from the dashboard — `evals.js` re-reads the audit trail it just produced and mechanically checks 11 compliance properties, exposed live at `GET /api/evals` and rendered on the dashboard's landing page:

```
Guardrail evals: 11/11 passed

  ✓ No case exceeds MAX_ATTEMPTS
  ✓ No back-to-back repeated action (no-spam)
  ✓ Discount never exceeds cap
  ✓ Discount never below amount floor
  ✓ Discount never offered twice on the same case
  ✓ Every audit entry has decision reasoning
  ✓ Every audit entry has a message/internal note
  ✓ No case recovers more than its own at-risk amount
  ✓ Total recovered <= total at risk
  ✓ No-action cases never show recovered amount
  ✓ Escalations only occur after a real attempt was made
```

Written to `server/audit/eval_report.json`; `npm run eval` also runs it standalone and exits non-zero on any failure so it can gate CI.

---

## Setup & run

Requires **Node.js 18+**.

```bash
# 1. Backend
cd server
npm install
cp .env.example .env        # then paste your GEMINI_API_KEY (see below)
npm start                   # http://localhost:4000 — runs the pipeline against
                             # the committed dataset (server/data/), runs evals,
                             # and starts serving, all on boot
# (server/data/transactions.json is already checked into the repo; run
#  `npm run generate` first only if you want a freshly-seeded dataset)

# 2. Frontend — in a second terminal
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Open **http://localhost:5173** for the dashboard. Click **"↻ Re-run pipeline"** on the Console page to trigger a fresh run live (calls `POST /api/run`).

### Enabling real LLM reasoning

Get a free key at **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**. Put it in `server/.env`:

```
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-3.5-flash-lite   # optional, see .env.example for alternatives
```

Optionally set `GEMINI_API_KEY_ASSISTANT` (a second, separate key) so the chatbot's quota never competes with the pipeline's — see `.env.example` for details. NVIDIA NIM (`NVIDIA_API_KEY`) is supported as an alternative provider if you'd rather use that instead of Gemini.

With no key set, the pipeline runs entirely on the deterministic rule engine — same audit trail shape, same guarantees, just without live model calls. `GET /api/health` always reports whether LLM mode is currently enabled and which model, and every audit entry is individually tagged `agent_source: "llm" | "rule_engine"` so a judge can see exactly which cases used which path.

### API reference

| Endpoint | Description |
|---|---|
| `GET /api/health` | Liveness + whether LLM mode is currently enabled |
| `GET /api/metrics` | Full computed metrics object |
| `GET /api/cases` | Case list, filterable by `?failure_reason=&severity=&status=&action=&q=` |
| `GET /api/cases/:transactionId` | One case + its complete audit trail |
| `GET /api/audit` | Raw audit entries, optional `?transaction_id=` |
| `GET /api/evals` | Live guardrail eval report for the most recent run |
| `GET /api/guardrail-scenarios` | List of stress-test scenarios |
| `POST /api/guardrail-stress-test` | Run one scenario through the real policy engine, live |
| `POST /api/assistant` | One chatbot turn — tool-calling over live pipeline state |
| `GET /api/export/cases.csv` / `GET /api/export/audit.csv` | Raw data export |
| `POST /api/run` | Re-runs the full pipeline (fresh dataset read, fresh simulation) |

---

## Measured results (rule-engine baseline run — nothing here is hand-typed)

Reproduce these exact numbers with `npm start` in `server/` (seeded RNG, deterministic; this baseline has no LLM key set):

| Metric | Value |
|---|---|
| Cases processed | **92** |
| Total agent attempts | **166** (avg 1.8 per case) |
| Recovery rate | **78.3%** overall · **87.8%** of cases the agent actually acted on |
| Amount recovered | **₹3,14,824** of **₹3,71,076** at risk |
| Avg time to recovery | **9.2 hours** |
| False-action rate | **10.9%** — cases the agent correctly chose *not* to act on |
| Escalated to human | **10 cases** — exhausted automation, handed off rather than guessed |
| Guardrail evals | **11/11 passed** |

Breakdowns by failure reason, action-conversion rate, and severity are all computed live and shown as charts on the dashboard. With a live `GEMINI_API_KEY` set, re-run the pipeline to get an LLM-reasoned version of the same run — the dashboard and every audit entry will show `agent_source: "llm"`.

---

## What I'd build next

- **Real channel integrations** — actual WhatsApp Business API / SMS gateway / Razorpay payment links instead of simulated execution, with real webhook-driven outcome tracking instead of a probability model.
- **Per-customer cooldown windows** — currently bounded per-transaction; a production system would also cap total nudges per customer per week across transactions.
- **A/B testing the decision policy** — compare LLM-recommended actions against the rule-engine baseline on the same dataset to measure the actual lift the model provides, then feed that back into prompt tuning.
- **Persist to a real database** (Postgres) instead of flat JSON/CSV, with the dashboard reading live instead of from a static pipeline run.
- **Auth + scoped access** — every endpoint here is open with no login, acceptable for a same-day demo but not for the real customer PII (names, amounts) this API currently serves unauthenticated.

---

## Repo layout

This is a single repo (monorepo) containing both services — deploy `server/` and `client/` as two separate services pointing at their own subdirectory.

```
vasooli/
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── generateDataset.js
│   │   ├── geminiClient.js    # Gemini (AI Studio) API client
│   │   ├── llmClient.js       # provider routing (Gemini / NVIDIA), per-role rate limiting
│   │   ├── llmAgent.js        # LLM diagnosis + recommendation + message prompt
│   │   ├── policy.js          # hard guardrails — validates/overrides the AI
│   │   ├── guardrailDemo.js   # synthetic scenarios for the live stress-test demo
│   │   ├── classify.js        # deterministic fallback: root cause + severity
│   │   ├── decide.js          # deterministic fallback: action selection
│   │   ├── message.js         # deterministic fallback: Hinglish templates
│   │   ├── simulate.js        # probabilistic outcome model
│   │   ├── pipeline.js        # orchestrates the whole agent loop
│   │   ├── evals.js           # guardrail eval suite
│   │   ├── assistant.js       # chatbot: tool selection + grounded answer
│   │   ├── metrics.js
│   │   ├── audit.js
│   │   ├── progress.js
│   │   └── server.js
│   ├── data/                  # generated dataset
│   ├── audit/                 # generated audit trail, metrics, eval report
│   └── .env.example
└── client/                    # React (Vite) dashboard
    └── src/
        ├── App.jsx
        ├── api.js
        ├── format.js
        ├── pages/              # Landing, Console, Pipeline, Assistant, Architecture
        ├── hooks/
        └── components/
```
