// --- Pipeline orchestrator ------------------------------------------------
// Reads the synthetic dataset and runs every transaction through the agent
// loop: an LLM (NVIDIA NIM) diagnoses the case and proposes an action +
// message each attempt; policy.js validates/overrides that proposal against
// hard-coded compliance limits; simulate.js runs the (simulated) execution;
// everything is written to the audit trail.
//
// If NVIDIA_API_KEY isn't set, or any individual LLM call fails (network,
// rate limit, malformed response), that attempt transparently falls back to
// the deterministic rule engine (classify.js + decide.js + message.js) —
// logged as such in the audit trail. The pipeline never crashes or stalls
// because the model had a bad day.

import "./env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyFailure } from "./classify.js";
import { decideAction } from "./decide.js";
import { buildMessage } from "./message.js";
import { simulateOutcome } from "./simulate.js";
import { writeAuditTrail, writeCaseSummaries, writeMetrics } from "./audit.js";
import { computeMetrics } from "./metrics.js";
import { mulberry32 } from "./rng.js";
import { ACTIONS, MAX_ATTEMPTS, enforcePolicy } from "./policy.js";
import { runLLMTurn } from "./llmAgent.js";
import { llmEnabled, DEFAULT_MODEL } from "./llmClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "transactions.json");

const simRng = mulberry32(2026);
const CONCURRENCY = Number(process.env.PIPELINE_CONCURRENCY || 8);

/**
 * Runs one agent turn: tries the LLM first (if enabled), falls back to the
 * deterministic rule engine on any failure. Always returns a normalized
 * shape regardless of which path produced it.
 */
async function agentTurn(txn, attemptNumber, history) {
  if (llmEnabled()) {
    try {
      const llm = await runLLMTurn(txn, attemptNumber, history);
      return {
        source: "llm",
        classification: {
          root_cause_category: llm.root_cause_category,
          root_cause_label: llm.root_cause_label,
          severity: llm.severity,
          reasoning: llm.diagnosis_reasoning,
        },
        proposed_action: llm.recommended_action,
        proposed_discount_pct: llm.discount_pct,
        decision_reasoning: llm.decision_reasoning,
        message: llm.message,
        fallback_reason: null,
      };
    } catch (err) {
      // Graceful degradation: log the failure, fall through to rule engine.
      return ruleBasedTurn(txn, attemptNumber, history, `llm_call_failed: ${err.message}`);
    }
  }
  return ruleBasedTurn(txn, attemptNumber, history, "llm_disabled: NVIDIA_API_KEY not set");
}

function ruleBasedTurn(txn, attemptNumber, history, fallbackReason) {
  const classification = classifyFailure(txn);
  const decision = decideAction(txn, classification, attemptNumber, history);
  const message = buildMessage(txn, classification, decision);
  return {
    source: "rule_engine",
    classification: {
      root_cause_category: classification.root_cause_category,
      root_cause_label: classification.root_cause_label,
      severity: classification.severity,
      reasoning: classification.reasoning,
    },
    proposed_action: decision.action,
    proposed_discount_pct: decision.discount_pct,
    decision_reasoning: decision.reasoning,
    message,
    fallback_reason: fallbackReason,
  };
}

async function processTransaction(txn, auditCounterRef) {
  const auditEntries = [];
  const history = [];
  let attemptNumber = 1;
  let finalStatus = "unresolved";
  let finalAction = null;
  let recoveredAmount = 0;
  let timeToRecoveryHours = null;
  let exceptionFlag = false;

  while (attemptNumber <= MAX_ATTEMPTS + 1) {
    const turn = await agentTurn(txn, attemptNumber, history);

    const policyResult = enforcePolicy(
      txn,
      attemptNumber,
      history,
      turn.proposed_action,
      turn.proposed_discount_pct
    );

    // If policy overrode the action, the original message may no longer fit
    // (e.g. a discount message when policy substituted a plain reminder).
    // Regenerate a safe fallback message via the deterministic templates
    // rather than sending mismatched text.
    let finalMessage = turn.message;
    if (policyResult.overridden) {
      const classification = classifyFailure(txn); // cheap, deterministic, just for template lookup
      finalMessage = buildMessage(
        txn,
        classification,
        { action: policyResult.action, discount_pct: policyResult.discount_pct, bounded_by: policyResult.override_reason }
      );
    }

    const outcome = simulateOutcome(
      txn,
      { root_cause_category: turn.classification.root_cause_category, severity: turn.classification.severity },
      { action: policyResult.action, discount_pct: policyResult.discount_pct },
      attemptNumber,
      simRng
    );

    auditCounterRef.n += 1;
    const auditEntry = {
      audit_id: `AUD${String(auditCounterRef.n).padStart(5, "0")}`,
      transaction_id: txn.transaction_id,
      customer_id: txn.customer_id,
      customer_name: txn.customer_name,
      amount_inr: txn.amount_inr,
      attempt_number: attemptNumber,
      agent_source: turn.source, // "llm" or "rule_engine"
      fallback_reason: turn.fallback_reason,
      classification: turn.classification,
      llm_proposed_action: turn.proposed_action,
      llm_decision_reasoning: turn.decision_reasoning,
      decision: {
        action: policyResult.action,
        discount_pct: policyResult.discount_pct,
        overridden_by_policy: policyResult.overridden,
        override_reason: policyResult.override_reason,
        reasoning: policyResult.overridden ? policyResult.override_reason : turn.decision_reasoning,
      },
      message: finalMessage,
      outcome,
      audit_timestamp: new Date().toISOString(),
    };
    auditEntries.push(auditEntry);
    history.push({ action: policyResult.action, outcome: outcome.status });

    finalAction = policyResult.action;

    if (policyResult.action === ACTIONS.NO_ACTION) {
      finalStatus = "no_action";
      break;
    }
    if (outcome.status === "recovered") {
      finalStatus = "recovered";
      recoveredAmount = outcome.recovered_amount;
      timeToRecoveryHours = outcome.time_to_recovery_hours;
      break;
    }
    if (policyResult.action === ACTIONS.ESCALATE) {
      finalStatus = "escalated_pending";
      break;
    }
    attemptNumber++;
    if (attemptNumber > MAX_ATTEMPTS) {
      finalStatus = "unresolved";
      exceptionFlag = true;
      break;
    }
  }

  const caseSummary = {
    transaction_id: txn.transaction_id,
    customer_id: txn.customer_id,
    customer_name: txn.customer_name,
    amount_inr: txn.amount_inr,
    failure_reason: txn.failure_reason,
    payment_method: txn.payment_method,
    is_recurring: txn.is_recurring,
    subscription_id: txn.subscription_id,
    root_cause_category: auditEntries[0]?.classification.root_cause_category,
    severity: auditEntries[0]?.classification.severity,
    attempts_made: attemptNumber,
    final_action: finalAction,
    final_status: finalStatus,
    recovered_amount: recoveredAmount,
    time_to_recovery_hours: timeToRecoveryHours,
    exception_flag: exceptionFlag,
    agent_source: auditEntries[0]?.agent_source,
    timestamp: txn.timestamp,
  };

  return { auditEntries, caseSummary };
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

async function runPipeline() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Dataset not found at ${DATA_PATH}. Run "npm run generate" first.`);
  }
  const transactions = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

  console.log(
    llmEnabled()
      ? `LLM mode: ON (NVIDIA NIM, model=${DEFAULT_MODEL}) — running with concurrency ${CONCURRENCY}`
      : `LLM mode: OFF (NVIDIA_API_KEY not set) — using deterministic rule engine`
  );

  const auditCounterRef = { n: 0 };
  const perTxnResults = await runPool(
    transactions,
    (txn) => processTransaction(txn, auditCounterRef),
    llmEnabled() ? CONCURRENCY : 1
  );

  const auditEntries = perTxnResults.flatMap((r) => r.auditEntries);
  const caseSummaries = perTxnResults.map((r) => r.caseSummary);

  const metrics = computeMetrics(caseSummaries, auditEntries);
  metrics.llm_enabled = llmEnabled();
  metrics.llm_model = llmEnabled() ? DEFAULT_MODEL : null;
  metrics.llm_fallback_count = auditEntries.filter((a) => a.agent_source === "rule_engine" && a.fallback_reason?.startsWith("llm_call_failed")).length;

  writeAuditTrail(auditEntries);
  writeCaseSummaries(caseSummaries);
  writeMetrics(metrics);

  console.log(`Pipeline run complete.`);
  console.log(`  Transactions processed: ${transactions.length}`);
  console.log(`  Audit entries written:  ${auditEntries.length}`);
  console.log(`  Recovery rate:          ${metrics.recovery_rate_pct}%`);
  console.log(`  Recovered:              ₹${metrics.total_recovered_inr.toLocaleString("en-IN")} of ₹${metrics.total_at_risk_inr.toLocaleString("en-IN")} at risk`);
  console.log(`  False-action rate:      ${metrics.false_action_rate_pct}% (correctly withheld action)`);
  if (llmEnabled()) {
    console.log(`  LLM call failures (fell back to rules): ${metrics.llm_fallback_count}`);
  }

  return { auditEntries, caseSummaries, metrics };
}

if (process.argv[1] && process.argv[1].endsWith("pipeline.js")) {
  runPipeline().catch((err) => {
    console.error("Pipeline failed:", err);
    process.exit(1);
  });
}

export { runPipeline };
