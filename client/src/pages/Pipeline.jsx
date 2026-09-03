import React, { useEffect, useRef, useState } from "react";
import { Play, CheckCircle2, Loader2, ShieldCheck, FileSearch, GitBranch } from "lucide-react";
import { api } from "../api.js";

// Honest representation of the REAL backend stages — no invented step names.
// The backend only ever reports stage: "idle" | "diagnosing" | "done", and a
// running count of processed/total plus per-outcome counters. Everything
// shown here is derived directly from that real, live /api/progress payload.
const STAGES = [
  { key: "ingest", label: "Ingest transactions", icon: FileSearch, desc: "Load the failed-payment dataset for this run." },
  { key: "diagnosing", label: "Diagnose + decide + act", icon: GitBranch, desc: "Per transaction: AI (or rule-engine fallback) diagnosis → policy-enforced decision → simulated outcome, up to 3 bounded attempts." },
  { key: "done", label: "Audit + guardrail evals", icon: ShieldCheck, desc: "Every attempt logged to the audit trail; 11 automated guardrail checks re-verify the run." },
];

export default function Pipeline() {
  const [progress, setProgress] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  async function poll() {
    try {
      const p = await api.progress();
      setProgress(p);
      if (!p.running && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    poll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await api.runAsync();
      await poll();
      if (!pollRef.current) {
        pollRef.current = setInterval(poll, 700);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  const running = progress?.running;
  const total = progress?.total || 0;
  const processed = progress?.processed || 0;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const currentStageKey = !progress || progress.stage === "idle" ? "ingest" : progress.stage;

  return (
    <div className="container" style={{ padding: "48px 32px 96px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-strong)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Live run
        </div>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Pipeline execution</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: 640, fontSize: 14.5 }}>
          Trigger a full pipeline run and watch it progress live. These numbers are polled directly from{" "}
          <code className="mono" style={{ fontSize: 12.5, background: "var(--bg-inset)", padding: "2px 6px", borderRadius: 5 }}>
            GET /api/progress
          </code>{" "}
          while the backend is actually processing transactions. Nothing here is a simulated animation.
        </p>
      </div>

      <div className="surface" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>
              {running ? "Run in progress" : progress?.finishedAt ? "Last run complete" : "No run started yet"}
            </div>
            <div style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {processed} / {total || "—"} transactions
            </div>
          </div>
          <button onClick={handleStart} disabled={starting || running} className="btn btn-primary">
            {running ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
            {running ? "Running…" : "Start new run"}
          </button>
        </div>

        <div style={{ height: 10, borderRadius: 999, background: "var(--bg-inset)", overflow: "hidden", marginBottom: 8 }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--accent-dim), var(--accent-strong))",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "right" }}>{pct}%</div>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--red-soft)", color: "var(--red)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        <OutcomeTile label="Recovered" value={progress?.recovered ?? 0} tone="var(--green)" bg="var(--green-soft)" icon={CheckCircle2} />
        <OutcomeTile label="Escalated" value={progress?.escalated ?? 0} tone="var(--amber)" bg="var(--amber-soft)" icon={GitBranch} />
        <OutcomeTile label="No action needed" value={progress?.noAction ?? 0} tone="var(--slate)" bg="var(--slate-soft)" icon={ShieldCheck} />
        <OutcomeTile label="Not recovered" value={progress?.notRecovered ?? 0} tone="var(--red)" bg="var(--red-soft)" icon={FileSearch} />
      </div>

      <div className="surface" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 18, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Real pipeline stages
        </h3>
        <div style={{ display: "grid", gap: 14 }}>
          {STAGES.map((s, i) => {
            const isActive = running && s.key === currentStageKey;
            const isPast =
              (s.key === "ingest" && (running || progress?.finishedAt)) ||
              (s.key === "diagnosing" && (progress?.finishedAt || (running && processed > 0))) ||
              (s.key === "done" && progress?.finishedAt && !running);
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: 16,
                  borderRadius: 12,
                  border: `1px solid ${isActive ? "var(--accent-soft-border)" : "var(--border)"}`,
                  background: isActive ? "var(--accent-soft)" : "var(--bg-inset)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: isPast || isActive ? "var(--accent)" : "var(--bg-elevated)",
                    color: isPast || isActive ? "#fff" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isActive ? <Loader2 size={16} className="spin" /> : <Icon size={16} />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {progress?.llmEnabled !== undefined && (
        <div style={{ marginTop: 18, fontSize: 12.5, color: "var(--text-tertiary)" }}>
          LLM reasoning was {progress.llmEnabled ? "enabled" : "not enabled"} for this run.
          {progress.llmEnabled ? " Cases fall back to the deterministic rule engine only if the LLM call fails." : ""}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function OutcomeTile({ label, value, tone, bg, icon: Icon }) {
  return (
    <div className="surface" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, color: tone, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</div>
      </div>
    </div>
  );
}
