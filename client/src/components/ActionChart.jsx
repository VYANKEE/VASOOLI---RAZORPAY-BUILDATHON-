import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ACTION_LABELS } from "../format.js";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
      <div style={{ color: "var(--text-secondary)" }}>{p.attempts} attempts · {p.converted} recovered</div>
      <div className="mono" style={{ color: "var(--accent-strong)", fontWeight: 700, marginTop: 2 }}>
        {p.conversion_rate_pct}% conversion
      </div>
    </div>
  );
}

export default function ActionChart({ breakdown }) {
  const data = [...breakdown]
    .sort((a, b) => b.conversion_rate_pct - a.conversion_rate_pct)
    .map((a) => ({
      name: ACTION_LABELS[a.action] || a.action,
      conversion_rate_pct: a.conversion_rate_pct,
      attempts: a.attempts,
      converted: a.converted,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "var(--text-primary)", fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-sunken)" }} />
        <Bar dataKey="conversion_rate_pct" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.name === "No Action" ? "var(--slate)" : "var(--accent)"} opacity={d.name === "No Action" ? 0.35 : 0.55 + (d.conversion_rate_pct / 100) * 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
