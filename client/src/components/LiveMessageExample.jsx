import React, { useEffect, useState } from "react";
import { MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "../api.js";

// Proof for the "Recovery message" step in HowItWorks: an actual customer
// message this run generated, not a mocked-up screenshot. Picks a real
// recovered case with a customer-facing action, fetches its audit trail,
// and renders the exact message text that was sent — same data the
// Console page's case-detail view shows, just surfaced here so the claim
// in step 4 has visible proof right next to it.
const PREFERRED_ACTIONS = ["discount_offer", "retry_payment_link", "reminder_nudge"];

export default function LiveMessageExample() {
  const [example, setExample] = useState(null);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tryFetch() {
      try {
        const cases = await api.cases();
        if (cancelled) return;
        const candidates = cases.filter((c) => PREFERRED_ACTIONS.includes(c.final_action) && c.final_status === "recovered");
        const pick = candidates[0] || cases.find((c) => PREFERRED_ACTIONS.includes(c.final_action));
        if (!pick) {
          setExample({ empty: true });
          return;
        }
        const detail = await api.caseDetail(pick.transaction_id);
        if (cancelled) return;
        const lastEntry = detail.audit_trail[detail.audit_trail.length - 1];
        setExample({
          customerName: pick.customer_name,
          amount: pick.amount_inr,
          transactionId: pick.transaction_id,
          action: pick.final_action,
          message: lastEntry?.message,
        });
      } catch (err) {
        if (cancelled) return;
        setNotReady(err?.status === 503);
        timer = setTimeout(tryFetch, 3000);
      }
    }
    tryFetch();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!example) {
    return (
      <div className="reveal surface" style={{ padding: 24, display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
        <Loader2 size={18} color="var(--accent)" className="lme-spin" />
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {notReady
            ? "Waiting for this run's pipeline to produce a real message…"
            : "Pulling a real generated message from this run…"}
        </div>
        <style>{`
          .lme-spin { animation: lmeSpin 0.9s linear infinite; }
          @keyframes lmeSpin { to { transform: rotate(360deg); } }
          @media (prefers-reduced-motion: reduce) { .lme-spin { animation: none !important; } }
        `}</style>
      </div>
    );
  }

  if (example.empty) return null;

  return (
    <div className="reveal surface" style={{ padding: 24, marginTop: 24, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: 24, alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <MessageCircle size={15} color="var(--accent-strong)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Real example, this run
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 10 }}>
          This is the actual message Step 4 generated for a real case in the dataset just now, not a mockup. Same
          text you'd see on the{" "}
          <span className="mono" style={{ fontSize: 12 }}>
            Console
          </span>{" "}
          page for this transaction.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11.5 }}>
          <span className="mono glass" style={{ padding: "3px 8px", borderRadius: 6, color: "var(--text-tertiary)" }}>
            {example.transactionId}
          </span>
          <span className="glass" style={{ padding: "3px 8px", borderRadius: 6, color: "var(--text-tertiary)" }}>
            ₹{example.amount?.toLocaleString("en-IN")}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: "var(--green-soft)", color: "var(--green)", fontWeight: 600 }}>
            <CheckCircle2 size={11} /> recovered
          </span>
        </div>
      </div>

      <div
        style={{
          background: "#e9f4ff",
          borderRadius: 14,
          padding: "18px 20px",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8, fontWeight: 600 }}>
          To: {example.customerName}
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: "4px 14px 14px 14px",
            padding: "12px 14px",
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-sm)",
            maxWidth: 440,
          }}
        >
          {example.message}
        </div>
      </div>
    </div>
  );
}
