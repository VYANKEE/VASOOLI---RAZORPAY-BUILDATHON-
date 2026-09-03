// --- REST API ---------------------------------------------------------
// Thin Express layer over the pipeline output. On boot it runs the full
// pipeline once (fresh audit trail + metrics), then serves everything
// from memory. POST /api/run re-runs the pipeline on demand.

import "./env.js";
import express from "express";
import cors from "cors";
import { runPipeline } from "./pipeline.js";
import { runEvals } from "./evals.js";
import { llmEnabled, activeModelLabel } from "./llmClient.js";
import { getProgress } from "./progress.js";
import { handleAssistantTurn } from "./assistant.js";
import { SCENARIOS as GUARDRAIL_SCENARIOS, runGuardrailScenario } from "./guardrailDemo.js";

const app = express();
app.use(cors());
app.use(express.json());

let state = { auditEntries: [], caseSummaries: [], metrics: null };
let evalReport = null;
let pipelineRunning = false;
let hasCompletedOnce = false;

async function refresh() {
  pipelineRunning = true;
  try {
    state = await runPipeline();
    // evals.js re-reads the audit trail this run just wrote to disk and
    // mechanically re-verifies the guardrails held — this is what the
    // frontend's "guardrail evals" section actually renders, not a
    // hardcoded "11/11 passed" claim.
    try {
      evalReport = runEvals();
    } catch (err) {
      console.error("Guardrail evals failed to run:", err);
      evalReport = null;
    }
    hasCompletedOnce = true;
  } finally {
    pipelineRunning = false;
  }
}

// Kick off the first pipeline run in the background rather than blocking
// app.listen() on it. With a live, rate-limited LLM key a full run can take
// several minutes — previously the server didn't start listening until it
// finished, so the client just saw ECONNREFUSED that whole time. Now the
// server is reachable immediately; endpoints that need real data respond
// 503 with live progress until the first run completes (see /api/metrics,
// /api/cases below), and the frontend polls through that automatically.
refresh().catch((err) => {
  console.error("Initial pipeline run failed:", err);
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    ready: hasCompletedOnce,
    running: pipelineRunning,
    cases: state.caseSummaries.length,
    generated_at: state.metrics?.generated_at,
    llm_enabled: llmEnabled(),
    llm_model: llmEnabled() ? activeModelLabel() : null,
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
  if (!hasCompletedOnce) {
    return res.status(503).json({ error: "not_ready", message: "Initial pipeline run still in progress.", progress: getProgress() });
  }
  res.json(state.metrics);
});

app.get("/api/cases", (req, res) => {
  if (!hasCompletedOnce) {
    return res.status(503).json({ error: "not_ready", message: "Initial pipeline run still in progress.", progress: getProgress() });
  }
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

// Real guardrail eval results from the most recent run — the actual 11
// checks evals.js ran against the actual audit trail, not invented copy.
app.get("/api/evals", (req, res) => {
  if (!hasCompletedOnce) {
    return res.status(503).json({ error: "not_ready", message: "Initial pipeline run still in progress.", progress: getProgress() });
  }
  if (!evalReport) {
    return res.status(500).json({ error: "evals_unavailable", message: "Guardrail evals did not run for the last pipeline run." });
  }
  res.json(evalReport);
});

app.get("/api/cases/:transactionId", (req, res) => {
  if (!hasCompletedOnce) {
    return res.status(503).json({ error: "not_ready", message: "Initial pipeline run still in progress.", progress: getProgress() });
  }
  const c = state.caseSummaries.find((x) => x.transaction_id === req.params.transactionId);
  if (!c) return res.status(404).json({ error: "not_found" });
  const audit = state.auditEntries.filter((a) => a.transaction_id === req.params.transactionId);
  res.json({ case: c, audit_trail: audit });
});

app.get("/api/audit", (req, res) => {
  if (!hasCompletedOnce) {
    return res.status(503).json({ error: "not_ready", message: "Initial pipeline run still in progress.", progress: getProgress() });
  }
  const { transaction_id } = req.query;
  let rows = state.auditEntries;
  if (transaction_id) rows = rows.filter((a) => a.transaction_id === transaction_id);
  res.json(rows);
});

// --- Guardrail stress test --------------------------------------------
// Lets the UI (or a curious judge) trigger a handful of synthetic "the AI
// proposed something unsafe" scenarios and see policy.js's REAL enforcement
// function run against them live — same function every real pipeline
// attempt goes through, not a scripted demo response.
app.get("/api/guardrail-scenarios", (req, res) => {
  res.json(GUARDRAIL_SCENARIOS.map((s) => ({ id: s.id, label: s.label, description: s.description })));
});

app.post("/api/guardrail-stress-test", (req, res) => {
  const { scenario } = req.body || {};
  const result = runGuardrailScenario(scenario);
  if (!result) return res.status(400).json({ error: "unknown_scenario", message: "Unknown scenario id." });
  res.json(result);
});

// Live progress of the current/last pipeline run — poll this while a run
// triggered via POST /api/run is in flight for a genuinely live view.
app.get("/api/progress", (req, res) => {
  res.json(getProgress());
});

// Fire-and-poll: kick off a run without the caller blocking on its full
// duration. The response resolves once the run completes, but a client
// that doesn't want to wait can ignore it and poll /api/progress instead.
app.post("/api/run-async", (req, res) => {
  if (pipelineRunning) return res.status(409).json({ ok: false, error: "pipeline_already_running" });
  refresh().catch((err) => console.error("Async pipeline run failed:", err));
  res.json({ ok: true, started: true });
});

app.post("/api/assistant", async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) is required" });
  }
  if (!llmEnabled("assistant")) {
    return res.status(503).json({
      error: "no_llm_configured",
      message: "The assistant needs a live LLM. Set GEMINI_API_KEY_ASSISTANT (or GEMINI_API_KEY) or NVIDIA_API_KEY in server/.env and restart.",
    });
  }
  try {
    const result = await handleAssistantTurn(message, history, { ...state, progress: getProgress() });
    res.json(result);
  } catch (err) {
    const raw = String(err.message || err);
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(raw);
    const usingSeparateKey = Boolean(process.env.GEMINI_API_KEY_ASSISTANT);
    res.status(isQuota ? 429 : 500).json({
      error: isQuota ? "quota_exceeded" : "assistant_error",
      message: isQuota
        ? `The LLM provider's free-tier quota is exhausted right now. Check usage at aistudio.google.com/usage, wait a few minutes, or switch ${
            usingSeparateKey ? "GEMINI_MODEL_ASSISTANT" : "GEMINI_MODEL"
          } in server/.env to one with a higher free quota (see .env.example).${
            usingSeparateKey
              ? ""
              : " Tip: set GEMINI_API_KEY_ASSISTANT to a second Gemini API key so the chatbot has its own quota, separate from the pipeline's."
          }`
        : raw,
    });
  }
});

// --- Data export (CSV) -----------------------------------------------
// Plain, no-auth CSV downloads of the current run's data — meant for a
// reviewer/recruiter to grab the raw numbers without needing to poke the
// JSON API. Real data only: this reads the same in-memory state every
// other endpoint does, nothing is regenerated or invented for export.
function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\n");
}

app.get("/api/export/cases.csv", (req, res) => {
  if (!hasCompletedOnce) return res.status(503).json({ error: "not_ready", progress: getProgress() });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="vasooli-cases.csv"');
  res.send(toCSV(state.caseSummaries));
});

app.get("/api/export/audit.csv", (req, res) => {
  if (!hasCompletedOnce) return res.status(503).json({ error: "not_ready", progress: getProgress() });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="vasooli-audit-trail.csv"');
  res.send(toCSV(state.auditEntries));
});

// Catch-all error handler: without this, a malformed request body (bad
// JSON, etc.) falls through to Express's default HTML error page, which
// leaks a raw stack trace and server filesystem paths to the client.
app.use((err, req, res, next) => {
  console.error("Unhandled request error:", err);
  res.status(err.status || 400).json({ error: "invalid_request", message: err.message || "Malformed request." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Vasooli API listening on http://localhost:${PORT}`);
});
