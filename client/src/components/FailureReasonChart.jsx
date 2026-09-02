import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { FAILURE_REASON_LABELS, formatINR } from "../format.js";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        boxShadow: "var(--shadow-md)",
        fontSize: 12.5,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--text-secondary)" }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="mono">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function FailureReasonChart({ breakdown }) {
  const data = breakdown.map((b) => ({
    name: FAILURE_REASON_LABELS[b.failure_reason] || b.failure_reason,
    "At risk": b.total_at_risk_inr,
    Recovered: b.total_recovered_inr,
    cases: b.total_cases,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11.5, fill: "var(--text-secondary)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          interval={0}
          angle={-18}
          textAnchor="end"
          height={52}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-sunken)" }} />
        <Legend wrapperStyle={{ fontSize: 12.5 }} iconType="circle" iconSize={8} />
        <Bar dataKey="At risk" fill="var(--slate)" opacity={0.35} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Recovered" fill="var(--accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
