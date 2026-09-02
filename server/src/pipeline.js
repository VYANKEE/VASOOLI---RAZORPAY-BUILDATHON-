// --- Pipeline orchestrator ------------------------------------------------
// Reads the synthetic dataset, runs every transaction through the agent
// loop (classify -> decide -> message -> simulate -> audit), enforcing the
// bounded-attempts / no-spam policy, and writes the audit trail + computed
// metrics to disk. This is the file to run to (re)produce every number
// quoted in the README — nothing downstream is hand-typed.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyFailure } from "./classify.js";
import { decideAction, ACTIONS, MAX_ATTEMPTS } from "./decide.js";
import { buildMessage } from "./message.js";
import { simulateOutcome } from "./simulate.js";
import { writeAuditTrail, writeCaseSummaries, writeMetrics } from "./audit.js";
import { computeMetrics } from "./metrics.js";
import { mulberry32 } from "./rng.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "transactions.json");

// Separate seed from dataset generation so re-running the pipeline against
// the same dataset is still deterministic but independent of how the
// dataset itself was produced.
const simRng = mulberry32(2026);

function runPipeline() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Dataset not found at ${DATA_PATH}. Run "npm run generate" first.`);
  }
  const transactions = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

  const auditEntries = [];
  const caseSummaries = [];
  let auditCounter = 1;

  for (const txn of transactions) {
    const classification = classifyFailure(txn);
    const history = [];
    let attemptNumber = 1;
    let finalStatus = "unresolved";
    let finalAction = null;
    let recoveredAmount = 0;
    let timeToRecoveryHours = null;
    let exceptionFlag = false;

    // Bounded loop: hard-capped by MAX_ATTEMPTS via decideAction's own
    // guard, plus a redundant local cap here as defense-in-depth against
    // any future bug in decideAction (never trust a single guardrail).
    while (attemptNumber <= MAX_ATTEMPTS + 1) {
      const decision = decideAction(txn, classification, attemptNumber, history);
      const message = buildMessage(txn, classification, decision);
      const outcome = simulateOutcome(txn, classification, decision, attemptNumber, simRng);

      const auditEntry = {
        audit_id: `AUD${String(auditCounter).padStart(5, "0")}`,
        transaction_id: txn.transaction_id,
        customer_id: txn.customer_id,
        customer_name: txn.customer_name,
        amount_inr: txn.amount_inr,
        attempt_number: attemptNumber,
        classification,
        decision,
        message,
        outcome,
        audit_timestamp: new Date().toISOString(),
      };
      auditEntries.push(auditEntry);
      auditCounter++;
      history.push({ action: decision.action, outcome: outcome.status });

      finalAction = decision.action;

      if (decision.action === ACTIONS.NO_ACTION) {
        finalStatus = "no_action";
        break;
      }
      if (outcome.status === "recovered") {
        finalStatus = "recovered";
        recoveredAmount = outcome.recovered_amount;
        timeToRecoveryHours = outcome.time_to_recovery_hours;
        break;
      }
      if (decision.action === ACTIONS.ESCALATE) {
        finalStatus = "escalated_pending";
        break;
      }
      // Not recovered and not a terminal action -> loop again (bounded)
      attemptNumber++;
      if (attemptNumber > MAX_ATTEMPTS) {
        // Should already have been escalated by decideAction's own guard;
        // this is the "handled gracefully" fallback if it somehow wasn't.
        finalStatus = "unresolved";
        exceptionFlag = true;
        break;
      }
    }

    caseSummaries.push({
      transaction_id: txn.transaction_id,
      customer_id: txn.customer_id,
      customer_name: txn.customer_name,
      amount_inr: txn.amount_inr,
      failure_reason: txn.failure_reason,
      payment_method: txn.payment_method,
      is_recurring: txn.is_recurring,
      subscription_id: txn.subscription_id,
      root_cause_category: classification.root_cause_category,
      severity: classification.severity,
      attempts_made: attemptNumber,
      final_action: finalAction,
      final_status: finalStatus,
      recovered_amount: recoveredAmount,
      time_to_recovery_hours: timeToRecoveryHours,
      exception_flag: exceptionFlag,
      timestamp: txn.timestamp,
    });
  }

  const metrics = computeMetrics(caseSummaries, auditEntries);

  writeAuditTrail(auditEntries);
  writeCaseSummaries(caseSummaries);
  writeMetrics(metrics);

  console.log(`Pipeline run complete.`);
  console.log(`  Transactions processed: ${transactions.length}`);
  console.log(`  Audit entries written:  ${auditEntries.length}`);
  console.log(`  Recovery rate:          ${metrics.recovery_rate_pct}%`);
  console.log(`  Recovered:              ₹${metrics.total_recovered_inr.toLocaleString("en-IN")} of ₹${metrics.total_at_risk_inr.toLocaleString("en-IN")} at risk`);
  console.log(`  False-action rate:      ${metrics.false_action_rate_pct}% (correctly withheld action)`);

  return { auditEntries, caseSummaries, metrics };
}

// Run directly if invoked as a script
if (process.argv[1] && process.argv[1].endsWith("pipeline.js")) {
  runPipeline();
}

export { runPipeline };
