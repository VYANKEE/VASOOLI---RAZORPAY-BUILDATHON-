import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, Loader2 } from "lucide-react";
import { api } from "../api.js";

// Renders the REAL guardrail eval report (server/src/evals.js re-reading the
// actual audit trail after every pipeline run) — not a hardcoded "11/11
// passed" claim. Each check name, pass/fail, and detail line comes straight
// from GET /api/evals. The only thing that's presentational is the staggered
// reveal (each row "ticks in" a little after the last) so it reads as the
// suite running through the list, one check at a time.
//
// The backend only has a report once the first pipeline run finishes, and
// with a live rate-limited LLM key that run can take minutes. Rather than
// rendering nothing that whole time (which reads as "this is broken"), a
// visible loading card is shown until the real report arrives.
export default function GuardrailEvals() {
  const [report, setReport] = useState(null);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    function tryFetch() {
      api
        .evals()
        .then((r) => {
          if (!cancelled) setReport(r);
        })
        .catch((err) => {
          if (cancelled) return;
          setNotReady(err?.status === 503);
          timer = setTimeout(tryFetch, 3000);
        });
    }
    tryFetch();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!report) {
    return (
      <div
        className="reveal in-view"
        style={{
          padding: 28,
          background: "#fff",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          minHeight: 220,
          textAlign: "center",
        }}
      >
        <Loader2 size={22} color="var(--accent)" className="spin" />
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
          Running the 11 guardrail checks…
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 280, lineHeight: 1.5 }}>
          {notReady
            ? "Waiting on this run's pipeline to finish first — with a live LLM key this can take a few minutes."
            : "Reading back the audit trail this run just wrote."}
        </div>
        <style>{`
          .spin { animation: evalSpin 0.9s linear infinite; }
          @keyframes evalSpin { to { transform: rotate(360deg); } }
          @media (prefers-reduced-motion: reduce) { .spin { animation: none !important; } }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="reveal"
      style={{
        padding: 28,
        background: "#fff",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
          Guardrail evals · this run
        </div>
        <div
          className="mono"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: report.failed === 0 ? "var(--green)" : "var(--red)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ShieldCheck size={13} />
          {report.passed}/{report.total_checks} passed
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 16, lineHeight: 1.5 }}>
        Read back from the audit trail this run actually wrote, right after it finished. Not a claim, a re-check.
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {report.checks.map((c, i) => (
          <div
            key={c.name}
            className="eval-row"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "9px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--border)",
              "--i": i,
            }}
          >
            {c.pass ? (
              <CheckCircle2 size={16} color="var(--green)" style={{ marginTop: 1, flexShrink: 0 }} />
            ) : (
              <XCircle size={16} color="var(--red)" style={{ marginTop: 1, flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>{c.name}</div>
              {!c.pass && (
                <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 2 }}>{c.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .eval-row {
          opacity: 0;
          transform: translateX(-6px);
        }
        .reveal.in-view .eval-row {
          animation: evalRowIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
          animation-delay: calc(var(--i, 0) * 90ms + 150ms);
        }
        @keyframes evalRowIn {
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .eval-row { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
