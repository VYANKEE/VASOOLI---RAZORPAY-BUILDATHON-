// --- Metrics computation --------------------------------------------------
// Every number here is derived from the case_summaries produced by an
// actual pipeline run — nothing in this file is a hardcoded/invented figure.

function computeMetrics(caseSummaries, auditEntries = []) {
  const total_cases = caseSummaries.length;
  const total_at_risk_inr = caseSummaries.reduce((s, c) => s + c.amount_inr, 0);

  const recoveredCases = caseSummaries.filter((c) => c.final_status === "recovered");
  const total_recovered_inr = recoveredCases.reduce((s, c) => s + c.amount_inr, 0);

  const actedCases = caseSummaries.filter((c) => c.final_status !== "no_action");
  const noActionCases = caseSummaries.filter((c) => c.final_status === "no_action");
  const escalatedPendingCases = caseSummaries.filter((c) => c.final_status === "escalated_pending");
  const unresolvedCases = caseSummaries.filter((c) => c.final_status === "unresolved");

  const recovery_rate_pct = total_cases > 0 ? (recoveredCases.length / total_cases) * 100 : 0;
  const recovery_rate_of_acted_pct = actedCases.length > 0 ? (recoveredCases.length / actedCases.length) * 100 : 0;
  const false_action_rate_pct = total_cases > 0 ? (noActionCases.length / total_cases) * 100 : 0;

  const recoveryTimes = recoveredCases
    .map((c) => c.time_to_recovery_hours)
    .filter((t) => t !== null && t !== undefined);
  const avg_time_to_recovery_hours =
    recoveryTimes.length > 0 ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : null;

  // Breakdown by failure reason
  const byFailureReason = {};
  for (const c of caseSummaries) {
    const key = c.failure_reason;
    if (!byFailureReason[key]) {
      byFailureReason[key] = {
        failure_reason: key,
        total_cases: 0,
        recovered_cases: 0,
        total_at_risk_inr: 0,
        total_recovered_inr: 0,
      };
    }
    byFailureReason[key].total_cases += 1;
    byFailureReason[key].total_at_risk_inr += c.amount_inr;
    if (c.final_status === "recovered") {
      byFailureReason[key].recovered_cases += 1;
      byFailureReason[key].total_recovered_inr += c.amount_inr;
    }
  }
  const failure_reason_breakdown = Object.values(byFailureReason).map((b) => ({
    ...b,
    recovery_rate_pct: b.total_cases > 0 ? Math.round((b.recovered_cases / b.total_cases) * 1000) / 10 : 0,
  }));

  // Breakdown by action: computed per attempt (from the audit trail), not
  // per case final-action — a case that succeeds always ends on the action
  // that worked, so scoring by "final action only" would trivially show
  // ~100% for every action. Scoring every attempt instance gives the real,
  // per-action conversion rate the agent is actually achieving.
  const byAction = {};
  const source = auditEntries.length > 0 ? auditEntries : [];
  for (const a of source) {
    const key = a.decision.action;
    if (!byAction[key]) byAction[key] = { action: key, attempts: 0, converted: 0 };
    byAction[key].attempts += 1;
    if (a.outcome.status === "recovered") byAction[key].converted += 1;
  }
  const action_breakdown = Object.values(byAction).map((a) => ({
    ...a,
    conversion_rate_pct: a.attempts > 0 ? Math.round((a.converted / a.attempts) * 1000) / 10 : 0,
  }));

  // Breakdown by severity
  const bySeverity = {};
  for (const c of caseSummaries) {
    const key = c.severity;
    if (!bySeverity[key]) bySeverity[key] = { severity: key, cases: 0, recovered: 0, at_risk_inr: 0, recovered_inr: 0 };
    bySeverity[key].cases += 1;
    bySeverity[key].at_risk_inr += c.amount_inr;
    if (c.final_status === "recovered") {
      bySeverity[key].recovered += 1;
      bySeverity[key].recovered_inr += c.amount_inr;
    }
  }
  const severity_breakdown = Object.values(bySeverity);

  const total_attempts = caseSummaries.reduce((s, c) => s + c.attempts_made, 0);

  return {
    generated_at: new Date().toISOString(),
    total_cases,
    total_at_risk_inr,
    total_recovered_inr,
    total_unrecovered_inr: total_at_risk_inr - total_recovered_inr,
    recovery_rate_pct: Math.round(recovery_rate_pct * 100) / 100,
    recovery_rate_of_acted_pct: Math.round(recovery_rate_of_acted_pct * 100) / 100,
    false_action_rate_pct: Math.round(false_action_rate_pct * 100) / 100,
    avg_time_to_recovery_hours:
      avg_time_to_recovery_hours !== null ? Math.round(avg_time_to_recovery_hours * 100) / 100 : null,
    cases_recovered: recoveredCases.length,
    cases_no_action: noActionCases.length,
    cases_escalated_pending: escalatedPendingCases.length,
    cases_unresolved: unresolvedCases.length,
    total_attempts_made: total_attempts,
    avg_attempts_per_case: total_cases > 0 ? Math.round((total_attempts / total_cases) * 100) / 100 : 0,
    failure_reason_breakdown,
    action_breakdown,
    severity_breakdown,
  };
}

export { computeMetrics };
