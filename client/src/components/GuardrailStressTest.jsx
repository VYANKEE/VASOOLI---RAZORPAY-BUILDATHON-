import React, { useEffect, useState } from "react";
import { ShieldAlert, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { api } from "../api.js";
import { ACTION_LABELS } from "../format.js";

function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

// Interactive proof for the buildathon's core ask ("bounded workflows with
// appropriate safeguards"): each scenario feeds a synthetic, deliberately
// unsafe AI proposal into the REAL enforcePolicy() function from
// server/src/policy.js via POST /api/guardrail-stress-test — nothing here
// is scripted client-side. What you see is whatever the actual policy
// engine actually decided for that input, live, on this request.
export default function GuardrailStressTest() {
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api
      .guardrailScenarios()
      .then((list) => {
        setScenarios(list);
        setSelected(list[0]?.id ?? null);
      })
      .catch(() => setLoadError(true));
  }, []);

  async function run() {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await api.guardrailStressTest(selected);
      setResult(r);
    } catch (err) {
      setResult({ error: err.message || "Stress test failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="surface" style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <ShieldAlert size={18} color="var(--accent-strong)" />
        <h3 style={{ fontSize: 16 }}>Try to break a guardrail</h3>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 18, maxWidth: 640 }}>
        Pick a way the AI might misbehave — repeat itself, blow past the attempt cap, invent an action, offer too big
        a discount. This runs the exact <span className="mono" style={{ fontSize: 12 }}>enforcePolicy()</span>{" "}
        function from <span className="mono" style={{ fontSize: 12 }}>policy.js</span> live, on this request — not a
        canned response.
      </p>

      {loadError && <div style={{ fontSize: 13, color: "var(--red)" }}>Couldn't load scenarios — is the API running?</div>}

      {!loadError && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          <select
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            style={{
              flex: "1 1 320px",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: 13.5,
            }}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button onClick={run} disabled={running || !selected} className="btn btn-primary" style={{ fontSize: 13.5 }}>
            {running ? <Loader2 size={14} className="gst-spin" /> : <ShieldAlert size={14} />}
            {running ? "Running…" : "Run stress test"}
          </button>
        </div>
      )}

      {result?.error && (
        <div style={{ fontSize: 13, color: "var(--red)", background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: 8, padding: "10px 14px" }}>
          {result.error}
        </div>
      )}

      {result && !result.error && (
        <div>
          <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 14, lineHeight: 1.55 }}>{result.scenario.description}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
            <div style={{ background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                AI proposed
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{actionLabel(result.ai_proposed.action)}</div>
              {result.ai_proposed.discount_pct != null && (
                <div className="mono" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{result.ai_proposed.discount_pct}% discount</div>
              )}
            </div>

            <ArrowRight size={20} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />

            <div
              style={{
                background: result.policy_result.blocked ? "var(--green-soft)" : "var(--bg-sunken)",
                border: `1px solid ${result.policy_result.blocked ? "var(--green)" : "var(--border-strong)"}`,
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: result.policy_result.blocked ? "var(--green)" : "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <ShieldCheck size={12} /> Policy engine's real verdict
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{actionLabel(result.policy_result.action)}</div>
              {result.policy_result.discount_pct != null && (
                <div className="mono" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{result.policy_result.discount_pct}% discount</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {result.policy_result.blocked ? (
              <>
                <strong style={{ color: "var(--green)" }}>Blocked / corrected. </strong>
                {result.policy_result.reason || "The proposed discount percentage was silently capped to the policy limit."}
              </>
            ) : (
              <>Policy engine allowed this proposal through unchanged — it didn't violate any hard limit.</>
            )}
          </div>
        </div>
      )}

      <style>{`
        .gst-spin { animation: gstSpin 0.9s linear infinite; }
        @keyframes gstSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .gst-spin { animation: none !important; } }
      `}</style>
    </div>
  );
}
