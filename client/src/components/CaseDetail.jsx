import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import Badge, { STATUS_TONE, SEVERITY_TONE } from "./Badge.jsx";
import { formatINR, formatDateTime, formatHours, FAILURE_REASON_LABELS, ACTION_LABELS, STATUS_LABELS } from "../format.js";

const OUTCOME_TONE = {
  recovered: "green",
  not_recovered: "red",
  escalated_pending: "amber",
  no_action: "slate",
};

export default function CaseDetail({ transactionId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!transactionId) return;
    setLoading(true);
    api
      .caseDetail(transactionId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (!transactionId) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(10,11,15,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        style={{
          position: "relative",
          width: "min(560px, 100vw)",
          height: "100%",
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          overflowY: "auto",
          padding: "24px 26px 60px",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "var(--bg-sunken)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            width: 32,
            height: 32,
            fontSize: 16,
            color: "var(--text-secondary)",
          }}
        >
          ✕
        </button>

        {loading && <div style={{ color: "var(--text-tertiary)", marginTop: 40 }}>Loading case…</div>}

        {data && (
          <>
            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Transaction
            </div>
            <h2 className="mono" style={{ fontSize: 19, marginBottom: 14 }}>{data.case.transaction_id}</h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              <Badge label={data.case.severity + " severity"} tone={SEVERITY_TONE[data.case.severity]} />
              <Badge label={STATUS_LABELS[data.case.final_status]} tone={STATUS_TONE[data.case.final_status]} />
              {data.case.is_recurring && <Badge label="Subscription" tone="accent" />}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 22,
                background: "var(--bg-sunken)",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}
            >
              <Field label="Customer" value={`${data.case.customer_name} (${data.case.customer_id})`} />
              <Field label="Amount" value={formatINR(data.case.amount_inr)} mono />
              <Field label="Payment Method" value={data.case.payment_method} />
              <Field label="Failure Reason" value={FAILURE_REASON_LABELS[data.case.failure_reason]} />
              <Field label="Root Cause" value={data.case.root_cause_category.replace(/_/g, " ")} />
              <Field label="Subscription" value={data.case.subscription_id || "—"} />
              <Field label="Attempts Made" value={`${data.case.attempts_made} of max 3`} />
              <Field label="Time to Recovery" value={formatHours(data.case.time_to_recovery_hours)} />
              <Field label="Occurred" value={formatDateTime(data.case.timestamp)} />
              <Field label="Recovered Amount" value={formatINR(data.case.recovered_amount)} mono />
            </div>

            <h3 style={{ fontSize: 14, marginBottom: 12, color: "var(--text-primary)" }}>
              Agent audit trail ({data.audit_trail.length} {data.audit_trail.length === 1 ? "entry" : "entries"})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.audit_trail.map((a) => (
                <AuditEntryCard key={a.audit_id} entry={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function AuditEntryCard({ entry }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        background: "var(--bg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent-strong)" }}>
          Attempt {entry.attempt_number} · {ACTION_LABELS[entry.decision.action] || entry.decision.action}
        </span>
        <Badge label={entry.outcome.status.replace(/_/g, " ")} tone={OUTCOME_TONE[entry.outcome.status] || "slate"} />
      </div>

      <DetailRow label="Classification">{entry.classification.reasoning}</DetailRow>
      <DetailRow label="Decision">{entry.decision.reasoning}</DetailRow>
      {entry.decision.bounded_by && (
        <DetailRow label="Guardrail">
          <span className="mono" style={{ fontSize: 11.5 }}>{entry.decision.bounded_by}</span>
        </DetailRow>
      )}
      <DetailRow label="Message sent">
        <div
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-soft-border)",
            borderRadius: 8,
            padding: "8px 10px",
            fontStyle: "italic",
            marginTop: 4,
          }}
        >
          {entry.message}
        </div>
      </DetailRow>
      <DetailRow label="Simulated outcome">{entry.outcome.simulation_note}</DetailRow>
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
