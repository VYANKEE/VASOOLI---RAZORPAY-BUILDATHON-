import React from "react";

const TONES = {
  green: { bg: "var(--green-soft)", fg: "var(--green)" },
  red: { bg: "var(--red-soft)", fg: "var(--red)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  slate: { bg: "var(--slate-soft)", fg: "var(--slate)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent-strong)" },
};

export const STATUS_TONE = {
  recovered: "green",
  no_action: "slate",
  escalated_pending: "amber",
  unresolved: "red",
};

export const SEVERITY_TONE = {
  low: "slate",
  medium: "accent",
  high: "amber",
  critical: "red",
};

export default function Badge({ label, tone = "slate" }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}
