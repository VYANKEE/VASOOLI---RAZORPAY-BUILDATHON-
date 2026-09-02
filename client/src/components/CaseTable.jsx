import React from "react";
import Badge, { STATUS_TONE, SEVERITY_TONE } from "./Badge.jsx";
import { formatINR, formatDateTime, FAILURE_REASON_LABELS, ACTION_LABELS, STATUS_LABELS } from "../format.js";

export default function CaseTable({ cases, onSelect, selectedId }) {
  if (cases.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>
        No cases match these filters.
      </div>
    );
  }

  return (
    <div className="scroll-x">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Transaction", "Customer", "Amount", "Failure Reason", "Severity", "Action Taken", "Attempts", "Status", "Time"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr
              key={c.transaction_id}
              onClick={() => onSelect(c.transaction_id)}
              style={{
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                background: selectedId === c.transaction_id ? "var(--accent-soft)" : "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => {
                if (selectedId !== c.transaction_id) e.currentTarget.style.background = "var(--bg-sunken)";
              }}
              onMouseLeave={(e) => {
                if (selectedId !== c.transaction_id) e.currentTarget.style.background = "transparent";
              }}
            >
              <td className="mono" style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                {c.transaction_id}
              </td>
              <td style={{ padding: "10px 14px", fontWeight: 500, whiteSpace: "nowrap" }}>{c.customer_name}</td>
              <td className="mono" style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{formatINR(c.amount_inr)}</td>
              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{FAILURE_REASON_LABELS[c.failure_reason]}</td>
              <td style={{ padding: "10px 14px" }}>
                <Badge label={c.severity} tone={SEVERITY_TONE[c.severity]} />
              </td>
              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{ACTION_LABELS[c.final_action] || c.final_action}</td>
              <td style={{ padding: "10px 14px", textAlign: "center" }}>{c.attempts_made}</td>
              <td style={{ padding: "10px 14px" }}>
                <Badge label={STATUS_LABELS[c.final_status] || c.final_status} tone={STATUS_TONE[c.final_status]} />
              </td>
              <td style={{ padding: "10px 14px", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                {formatDateTime(c.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
