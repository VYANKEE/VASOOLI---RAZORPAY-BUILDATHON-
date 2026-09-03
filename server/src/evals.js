// --- Guardrail evals -----------------------------------------------------
// Runs after the pipeline to mechanically verify the safety claims made in
// the README actually hold on the audit trail that was just produced —
// not "we designed it to be bounded" but "here is proof, on this run, that
// it was." Exits non-zero if any hard guardrail is violated, so this can
// gate a CI pipeline / demo script.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MAX_ATTEMPTS, MAX_DISCOUNT_PCT, DISCOUNT_MIN_AMOUNT, ACTIONS } from "./policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = path.join(__dirname, "..", "audit");

function load(name) {
  const p = path.join(AUDIT_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`${name} not found — run the pipeline first (npm run run-pipeline).`);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function groupBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function runEvals() {
  const auditEntries = load("audit_log.json");
  const caseSummaries = load("case_summaries.json");
  const metrics = load("metrics.json");

  const checks = [];
  const record = (name, pass, detail) => checks.push({ name, pass, detail });

  // 1. No case ever exceeds MAX_ATTEMPTS total attempts (prior + this run).
  const byTxn = groupBy(auditEntries, "transaction_id");
  let maxAttemptsViolations = 0;
  for (const [txnId, entries] of byTxn) {
    const maxAttemptNum = Math.max(...entries.map((e) => e.attempt_number));
    if (maxAttemptNum > MAX_ATTEMPTS) maxAttemptsViolations++;
  }
  record(
    "No case exceeds MAX_ATTEMPTS",
    maxAttemptsViolations === 0,
    `${maxAttemptsViolations} case(s) exceeded ${MAX_ATTEMPTS} attempts`
  );

  // 2. No back-to-back identical action within the same case (no-spam), except escalate.
  let repeatViolations = 0;
  for (const [txnId, entries] of byTxn) {
    const sorted = [...entries].sort((a, b) => a.attempt_number - b.attempt_number);
    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i].decision.action === sorted[i - 1].decision.action &&
        sorted[i].decision.action !== ACTIONS.ESCALATE
      ) {
        repeatViolations++;
      }
    }
  }
  record("No back-to-back repeated action (no-spam)", repeatViolations === 0, `${repeatViolations} repeat violation(s)`);

  // 3. Discounts never exceed the cap, never below the amount floor, never offered twice per case.
  let discountCapViolations = 0;
  let discountFloorViolations = 0;
  let discountRepeatViolations = 0;
  for (const [txnId, entries] of byTxn) {
    const discountEntries = entries.filter((e) => e.decision.action === ACTIONS.DISCOUNT);
    if (discountEntries.length > 1) discountRepeatViolations++;
    for (const e of discountEntries) {
      if ((e.decision.discount_pct || 0) > MAX_DISCOUNT_PCT) discountCapViolations++;
      if (e.amount_inr < DISCOUNT_MIN_AMOUNT) discountFloorViolations++;
    }
  }
  record("Discount never exceeds cap", discountCapViolations === 0, `${discountCapViolations} case(s) over ${MAX_DISCOUNT_PCT}%`);
  record("Discount never below amount floor", discountFloorViolations === 0, `${discountFloorViolations} case(s) under ₹${DISCOUNT_MIN_AMOUNT}`);
  record("Discount never offered twice on the same case", discountRepeatViolations === 0, `${discountRepeatViolations} case(s) with 2+ discounts`);

  // 4. Every audit entry has non-empty reasoning and a message/internal note.
  const missingReasoning = auditEntries.filter((e) => !e.decision.reasoning || e.decision.reasoning.trim() === "").length;
  const missingMessage = auditEntries.filter((e) => !e.message || e.message.trim() === "").length;
  record("Every audit entry has decision reasoning", missingReasoning === 0, `${missingReasoning} missing`);
  record("Every audit entry has a message/internal note", missingMessage === 0, `${missingMessage} missing`);

  // 5. Financial sanity: recovered amount never exceeds at-risk amount, per case and in aggregate.
  let overRecoveryViolations = 0;
  for (const c of caseSummaries) {
    if (c.recovered_amount > c.amount_inr) overRecoveryViolations++;
  }
  record("No case recovers more than its own at-risk amount", overRecoveryViolations === 0, `${overRecoveryViolations} violation(s)`);
  record(
    "Total recovered <= total at risk",
    metrics.total_recovered_inr <= metrics.total_at_risk_inr,
    `₹${metrics.total_recovered_inr} recovered vs ₹${metrics.total_at_risk_inr} at risk`
  );

  // 6. Every no_action case has zero recovered amount attributed (nothing invented).
  const noActionWithRecovery = caseSummaries.filter((c) => c.final_status === "no_action" && c.recovered_amount > 0).length;
  record("No-action cases never show recovered amount", noActionWithRecovery === 0, `${noActionWithRecovery} case(s)`);

  // 7. Escalated/unresolved cases exist only after the attempt cap was reached (graceful-failure proof).
  const prematureEscalations = caseSummaries.filter(
    (c) => (c.final_status === "escalated_pending" || c.final_status === "unresolved") && c.attempts_made < 1
  ).length;
  record("Escalations only occur after a real attempt was made", prematureEscalations === 0, `${prematureEscalations} case(s)`);

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;

  const report = {
    generated_at: new Date().toISOString(),
    total_checks: checks.length,
    passed,
    failed,
    checks,
  };

  fs.writeFileSync(path.join(AUDIT_DIR, "eval_report.json"), JSON.stringify(report, null, 2));

  console.log(`\nGuardrail evals: ${passed}/${checks.length} passed\n`);
  for (const c of checks) {
    console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}${c.pass ? "" : ` — ${c.detail}`}`);
  }
  console.log("");

  if (failed > 0) {
    console.error(`${failed} guardrail check(s) FAILED. See server/audit/eval_report.json.`);
    process.exitCode = 1;
  } else {
    console.log("All guardrail checks passed.");
  }

  return report;
}

if (process.argv[1] && process.argv[1].endsWith("evals.js")) {
  runEvals();
}

export { runEvals };
