// --- REST API ---------------------------------------------------------
// Thin Express layer over the pipeline output. On boot it runs the full
// pipeline once (fresh audit trail + metrics), then serves everything
// from memory. POST /api/run re-runs the pipeline on demand.

import "./env.js";
import express from "express";
import cors from "cors";
import { runPipeline } from "./pipeline.js";
import { llmEnabled, DEFAULT_MODEL } from "./llmClient.js";

const app = express();
app.use(cors());
app.use(express.json());

let state = { auditEntries: [], caseSummaries: [], metrics: null };
let pipelineRunning = false;

async function refresh() {
  pipelineRunning = true;
  try {
    state = await runPipeline();
  } finally {
    pipelineRunning = false;
  }
}

const bootPromise = refresh().catch((err) => {
  console.error("Initial pipeline run failed:", err);
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    running: pipelineRunning,
    cases: state.caseSummaries.length,
    generated_at: state.metrics?.generated_at,
    llm_enabled: llmEnabled(),
    llm_model: llmEnabled() ? DEFAULT_MODEL : null,
  });
});

app.post("/api/run", async (req, res) => {
  if (pipelineRunning) return res.status(409).json({ ok: false, error: "pipeline_already_running" });
  try {
    await refresh();
    res.json({ ok: true, metrics: state.metrics });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
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
bootPromise.finally(() => {
  app.listen(PORT, () => {
    console.log(`Recovery Agent API listening on http://localhost:${PORT}`);
  });
});
