import React from "react";

export default function StatTile({ label, value, sub, accent, mono }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "var(--shadow-sm)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "mono" : ""}
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: accent ? "var(--accent-strong)" : "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{sub}</span>
      )}
    </div>
  );
}
