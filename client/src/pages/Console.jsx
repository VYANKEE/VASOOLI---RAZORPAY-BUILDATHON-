import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { api } from "../api.js";
import StatTile from "../components/StatTile.jsx";
import FailureReasonChart from "../components/FailureReasonChart.jsx";
import ActionChart from "../components/ActionChart.jsx";
import CaseTable from "../components/CaseTable.jsx";
import CaseDetail from "../components/CaseDetail.jsx";
import { formatINR, formatPct, formatHours, FAILURE_REASON_LABELS, ACTION_LABELS } from "../format.js";

export default function Console() {
  const [metrics, setMetrics] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [bootProgress, setBootProgress] = useState(null);
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
    let cancelled = false;
    let timer;

    // The server can take a while to become reachable on first boot — with
    // a live LLM key it runs one full pipeline pass (rate-limited LLM
    // calls) before it starts listening. Rather than crashing on the
    // inevitable failed request during that window, keep retrying and show
    // a "still connecting" state instead.
    async function attempt() {
      try {
        await loadAll();
        if (cancelled) return;
        setLoading(false);
        setConnecting(false);
      } catch (e) {
        if (cancelled) return;
        setLoading(false);
        setConnecting(true);
        // Best-effort: show real progress (X/Y transactions) while we wait,
        // pulled from the error body if the server sent it, else polled
        // separately. Never lets a failure here block the retry loop.
        if (e.data?.progress) setBootProgress(e.data.progress);
        else api.progress().then(setBootProgress).catch(() => {});
        timer = setTimeout(attempt, 2500);
      }
    }

    attempt();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", color: "var(--text-tertiary)" }}>
        Loading console…
      </div>
    );
  }

  if (connecting || !metrics) {
    const p = bootProgress;
    const pct = p?.total ? Math.min(100, Math.round((p.processed / p.total) * 100)) : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: 10, textAlign: "center", padding: "0 24px" }}>
        <RefreshCw size={22} className="spin" color="var(--accent-strong)" />
        <div style={{ fontSize: 15, color: "var(--text-primary)", marginTop: 8 }}>
          {p?.total ? `Running the pipeline, ${p.processed}/${p.total} transactions processed…` : "Connecting to Vasooli…"}
        </div>
        {pct !== null && (
          <div style={{ width: 260, height: 8, borderRadius: 999, background: "var(--bg-inset)", overflow: "hidden", margin: "4px 0" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--accent-dim), var(--accent-strong))", transition: "width 0.3s ease" }} />
          </div>
        )}
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 440 }}>
          {p?.llmEnabled
            ? "A live, rate-limited LLM key is set, so the first run takes a few minutes. This page connects automatically once it's ready."
            : "The server is starting up. This page will connect automatically once it's ready."}
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        onRerun={handleRerun}
        rerunning={rerunning}
        generatedAt={metrics?.generated_at}
      />

      <div className="container" style={{ padding: "0 32px 80px" }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 20,
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
            marginBottom: 20,
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
      </div>

      <CaseDetail transactionId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function PageHeader({ onRerun, rerunning, generatedAt }) {
  return (
    <div className="glass" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="container" style={{ padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Transaction Intelligence Console</h1>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Live case data, decisions, and outcomes from the recovery pipeline.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {generatedAt && (
            <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
              Last run: {new Date(generatedAt).toLocaleTimeString("en-IN")}
            </span>
          )}
          <a href="/api/export/cases.csv" download className="btn btn-ghost" style={{ fontSize: 13 }} title="Download all cases as CSV">
            <Download size={14} />
            Download data
          </a>
          <button onClick={onRerun} disabled={rerunning} className="btn btn-primary" style={{ fontSize: 13 }}>
            <RefreshCw size={14} className={rerunning ? "spin" : ""} />
            {rerunning ? "Running…" : "Re-run pipeline"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function Panel({ title, right, children }) {
  return (
    <div className="surface" style={{ boxShadow: "var(--shadow-sm)", marginBottom: 14 }}>
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
