// --- REST API ---------------------------------------------------------
// Thin Express layer over the pipeline output. On boot it runs the full
// pipeline once (fresh audit trail + metrics), then serves everything
// from memory. POST /api/run re-runs the pipeline on demand.

import express from "express";
import cors from "cors";
import { runPipeline } from "./pipeline.js";

const app = express();
app.use(cors());
app.use(express.json());

let state = { auditEntries: [], caseSummaries: [], metrics: null };

function refresh() {
  state = runPipeline();
}

refresh();

app.get("/api/health", (req, res) => {
  res.json({ ok: true, cases: state.caseSummaries.length, generated_at: state.metrics?.generated_at });
});

app.post("/api/run", (req, res) => {
  refresh();
  res.json({ ok: true, metrics: state.metrics });
});

app.get("/api/metrics", (req, res) => {
  res.json(state.metrics);
});

app.get("/api/cases", (req, res) => {
  const { failure_reason, severity, status, action, q } = req.query;
  let rows = state.caseSummaries;
  if (failure_reason) rows = rows.filter((c) => c.failure_reason === failure_reason);
  if (severity) rows = rows.filter((c) => c.severity === severity);
  if (status) rows = rows.filter((c) => c.final_status === status);
  if (action) rows = rows.filter((c) => c.final_action === action);
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (c) =>
        c.customer_name.toLowerCase().includes(needle) ||
        c.transaction_id.toLowerCase().includes(needle) ||
        c.customer_id.toLowerCase().includes(needle) ||
        (c.subscription_id || "").toLowerCase().includes(needle)
    );
  }
  res.json(rows);
});

app.get("/api/cases/:transactionId", (req, res) => {
  const c = state.caseSummaries.find((x) => x.transaction_id === req.params.transactionId);
  if (!c) return res.status(404).json({ error: "not_found" });
  const audit = state.auditEntries.filter((a) => a.transaction_id === req.params.transactionId);
  res.json({ case: c, audit_trail: audit });
});

app.get("/api/audit", (req, res) => {
  const { transaction_id } = req.query;
  let rows = state.auditEntries;
  if (transaction_id) rows = rows.filter((a) => a.transaction_id === transaction_id);
  res.json(rows);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Recovery Agent API listening on http://localhost:${PORT}`);
});
