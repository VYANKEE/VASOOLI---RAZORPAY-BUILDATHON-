import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import StatTile from "./components/StatTile.jsx";
import FailureReasonChart from "./components/FailureReasonChart.jsx";
import ActionChart from "./components/ActionChart.jsx";
import CaseTable from "./components/CaseTable.jsx";
import CaseDetail from "./components/CaseDetail.jsx";
import { formatINR, formatPct, formatHours, FAILURE_REASON_LABELS, ACTION_LABELS } from "./format.js";

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");
  const [failureFilter, setFailureFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  async function loadAll() {
    const [m, c] = await Promise.all([api.metrics(), api.cases()]);
    setMetrics(m);
    setCases(c);
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  async function handleRerun() {
    setRerunning(true);
    try {
      await api.rerun();
      await loadAll();
    } finally {
      setRerunning(false);
    }
  }

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (failureFilter && c.failure_reason !== failureFilter) return false;
      if (statusFilter && c.final_status !== statusFilter) return false;
      if (actionFilter && c.final_action !== actionFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const haystack = `${c.customer_name} ${c.transaction_id} ${c.customer_id} ${c.subscription_id || ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [cases, search, failureFilter, statusFilter, actionFilter]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-tertiary)" }}>
        Loading Recovery Agent console…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopBar onRerun={handleRerun} rerunning={rerunning} generatedAt={metrics?.generated_at} />

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px 60px" }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <StatTile label="Cases Processed" value={metrics.total_cases} sub={`${metrics.total_attempts_made} agent attempts total`} mono />
          <StatTile label="Recovery Rate" value={formatPct(metrics.recovery_rate_pct)} sub={`${formatPct(metrics.recovery_rate_of_acted_pct)} of acted-on cases`} accent />
          <StatTile label="Amount Recovered" value={formatINR(metrics.total_recovered_inr)} sub={`of ${formatINR(metrics.total_at_risk_inr)} at risk`} accent mono />
          <StatTile label="Avg Time to Recovery" value={formatHours(metrics.avg_time_to_recovery_hours)} sub="from first detection" />
          <StatTile label="False-Action Rate" value={formatPct(metrics.false_action_rate_pct)} sub={`${metrics.cases_no_action} cases correctly not actioned`} />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <Panel title="Revenue at risk vs. recovered, by failure reason">
            <FailureReasonChart breakdown={metrics.failure_reason_breakdown} />
          </Panel>
          <Panel title="Conversion rate by recovery action">
            <ActionChart breakdown={metrics.action_breakdown} />
          </Panel>
        </section>

        <Panel
          title={`Audit log · ${filtered.length} of ${cases.length} cases`}
          right={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="Search customer, txn ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={inputStyle(160)}
              />
              <select value={failureFilter} onChange={(e) => setFailureFilter(e.target.value)} style={inputStyle(150)}>
                <option value="">All failure reasons</option>
                {Object.entries(FAILURE_REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={inputStyle(140)}>
                <option value="">All actions</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle(130)}>
                <option value="">All statuses</option>
                <option value="recovered">Recovered</option>
                <option value="no_action">No Action</option>
                <option value="escalated_pending">Escalated</option>
                <option value="unresolved">Unresolved</option>
              </select>
            </div>
          }
        >
          <CaseTable cases={filtered} onSelect={setSelectedId} selectedId={selectedId} />
        </Panel>
      </main>

      <CaseDetail transactionId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function TopBar({ onRerun, rerunning, generatedAt }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
        padding: "14px 24px",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            R
          </div>
          <div>
            <h1 style={{ fontSize: 16 }}>Recovery Agent</h1>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>AI Revenue Recovery Console</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {generatedAt && (
            <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
              Last run: {new Date(generatedAt).toLocaleTimeString("en-IN")}
            </span>
          )}
          <button
            onClick={onRerun}
            disabled={rerunning}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              opacity: rerunning ? 0.6 : 1,
            }}
          >
            {rerunning ? "Running…" : "↻ Re-run pipeline"}
          </button>
        </div>
      </div>
    </header>
  );
}

function Panel({ title, right, children }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h3 style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{title}</h3>
        {right}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function inputStyle(width) {
  return {
    width,
    padding: "7px 10px",
    fontSize: 12.5,
    borderRadius: 7,
    border: "1px solid var(--border-strong)",
    background: "var(--bg)",
    color: "var(--text-primary)",
  };
}
