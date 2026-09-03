import React, { useState } from "react";
import { Database, Sparkles, ShieldCheck, GitBranch, MessageSquare, Activity, ChevronRight } from "lucide-react";
import GuardrailStressTest from "../components/GuardrailStressTest.jsx";

const STAGES = [
  {
    key: "ingest",
    icon: Database,
    title: "1 · Ingest",
    short: "Load transaction dataset",
    detail:
      "The pipeline loads the synthetic Indian fintech transaction set (server/data/transactions.json): failed payments and abandoned checkouts with amount, failure reason, payment method, subscription/recurring flags, and prior recovery attempts.",
  },
  {
    key: "agent",
    icon: Sparkles,
    title: "2 · LLM Agent",
    short: "Diagnose + propose",
    detail:
      "For each attempt, the configured LLM provider (Gemini or NVIDIA NIM, whichever key is set) is asked to diagnose the root cause, assign a severity, and propose a recovery action + Hinglish customer message as strict JSON. If the LLM call fails for any reason, the run falls back to a deterministic rule engine (classify.js / decide.js / message.js). Every fallback is logged with a reason, never silently swallowed.",
  },
  {
    key: "policy",
    icon: ShieldCheck,
    title: "3 · Policy Engine",
    short: "Validate + override",
    detail:
      "policy.js is the single source of truth for hard safety limits. It never trusts the LLM's proposal outright. It enforces: a 3-attempt cap per case, a hard stop that forces escalation past the cap, rejection of unrecognized actions, a no-repeat-action rule so customers aren't spammed with the same lever twice, a discount floor/cap (max 15%, min ₹500 order value, offered at most once), and an actionability threshold that withholds action on very low-value, non-recurring cases.",
  },
  {
    key: "simulate",
    icon: GitBranch,
    title: "4 · Simulate outcome",
    short: "Probabilistic recovery model",
    detail:
      "The policy-approved action is run through a seeded probabilistic outcome model (simulate.js). Different actions and failure reasons carry different real-world-plausible recovery probabilities, producing a final per-attempt status: recovered, no_action, escalated_pending, or unresolved (retried on the next attempt, up to the 3-attempt cap).",
  },
  {
    key: "audit",
    icon: Activity,
    title: "5 · Audit + evals",
    short: "Log every attempt, verify the run",
    detail:
      "Every single attempt, LLM or fallback, overridden or not, is written to an append-only audit trail with full reasoning, the raw proposal, and the policy decision. After each run, an automated 11-check guardrail eval suite (evals.js) re-verifies the trail itself (attempt caps respected, no repeated actions, discount rules honored, etc.) and writes a pass/fail report: proof the guardrails held, not just a claim that they do.",
  },
  {
    key: "assistant",
    icon: MessageSquare,
    title: "Assistant · Tool-calling",
    short: "Grounded Q&A over the run",
    detail:
      "The chat assistant runs a two-hop protocol on the same LLM router: the model first picks one tool (get_metrics, search_cases, get_case_detail, get_pipeline_status) and arguments from a fixed list, the tool executes against the real in-memory pipeline state, and the model answers using only that tool result. It never receives the full dataset in-prompt and never answers from parametric memory.",
  },
];

export default function Architecture() {
  const [activeKey, setActiveKey] = useState(STAGES[1].key);
  const active = STAGES.find((s) => s.key === activeKey) || STAGES[0];

  return (
    <div className="container" style={{ padding: "48px 32px 96px" }}>
      <div style={{ marginBottom: 36, maxWidth: 680 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-strong)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          System design
        </div>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>How Vasooli is built</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14.5 }}>
          A hybrid AI architecture: the LLM proposes, a deterministic policy engine decides. Click a stage to see
          exactly what it does and why it's separated from the rest.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
            padding: 16,
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--bg-sunken)",
          }}
        >
          {STAGES.slice(0, 5).map((s, i) => (
            <React.Fragment key={s.key}>
              <StageChip stage={s} active={s.key === activeKey} onClick={() => setActiveKey(s.key)} />
              {i < 4 && <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <StageChip stage={STAGES[5]} active={activeKey === STAGES[5].key} onClick={() => setActiveKey(STAGES[5].key)} standalone />
        </div>
      </div>

      <div className="surface" style={{ padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <active.icon size={19} />
          </div>
          <div>
            <h3 style={{ fontSize: 17 }}>{active.title}</h3>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>{active.short}</div>
          </div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--text-secondary)" }}>{active.detail}</p>
      </div>

      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <InfoCard
          title="Why the split?"
          body="The buildathon brief calls for compliant stopping rules and bounded workflows with safeguards. If the model held the safety limits itself, a bad or manipulated generation could bypass them. Splitting proposal (LLM) from enforcement (plain code in policy.js) means the guardrails hold even when the model doesn't behave."
        />
        <InfoCard
          title="Why a rule-engine fallback?"
          body="LLM APIs fail: rate limits, timeouts, malformed JSON. Vasooli never blocks or crashes on that; it falls back to a deterministic rule engine (classify.js / decide.js / message.js) and logs the fallback reason, so the pipeline always finishes and the audit trail always shows which path was taken."
        />
        <InfoCard
          title="Why evals, not just a demo?"
          body="evals.js re-reads the actual audit trail after every run and checks it against the same rules policy.js is supposed to enforce: attempt caps, no-repeat actions, discount limits. It's a proof step, not a claim. The report is written to server/audit/eval_report.json and the pipeline build fails if it doesn't pass."
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <GuardrailStressTest />
      </div>
    </div>
  );
}

function StageChip({ stage, active, onClick, standalone }) {
  const Icon = stage.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        border: `1px solid ${active ? "var(--accent-soft-border)" : "var(--border-strong)"}`,
        background: active ? "var(--accent-soft)" : "var(--bg-elevated)",
        color: active ? "var(--accent-strong)" : "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={13} />
      {stage.title.replace(/^\d+\s·\s/, standalone ? "" : "")}
    </button>
  );
}

function InfoCard({ title, body }) {
  return (
    <div className="surface" style={{ padding: 20 }}>
      <h4 style={{ fontSize: 14, marginBottom: 8 }}>{title}</h4>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-tertiary)" }}>{body}</p>
    </div>
  );
}
