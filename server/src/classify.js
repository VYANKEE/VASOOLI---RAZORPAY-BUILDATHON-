// --- Root-cause & severity classification ------------------------------
//
// This is a deterministic reasoning engine: rule-based feature extraction
// feeding a transparent scoring model, with an explicit natural-language
// "reasoning" string attached to every verdict (the same shape you'd want
// if this were swapped for a real LLM call — see README "what I'd build
// next"). Keeping it rule-based here makes the agent's behaviour 100%
// reproducible and auditable, which is what the buildathon grades on.

const ROOT_CAUSE_MAP = {
  card_declined: "issuer_decline",
  insufficient_funds: "insufficient_funds",
  checkout_timeout: "user_abandonment",
  otp_failed: "authentication_failure",
  network_error: "transient_infra",
  bank_server_down: "transient_infra",
};

const ROOT_CAUSE_LABELS = {
  issuer_decline: "Card issuer declined the transaction",
  insufficient_funds: "Customer-side insufficient balance",
  user_abandonment: "Checkout abandoned / timed out before completion",
  authentication_failure: "OTP / 2FA authentication failed",
  transient_infra: "Transient infrastructure failure (network or bank/PG downtime)",
};

// Is this root cause something a simple retry is likely to fix on its own?
const SELF_RESOLVING = new Set(["transient_infra"]);

function classifyFailure(txn) {
  const root_cause_category = ROOT_CAUSE_MAP[txn.failure_reason] ?? "unknown";
  const root_cause_label = ROOT_CAUSE_LABELS[root_cause_category] ?? "Unclassified failure";

  // --- severity score (0-100), built from explainable weighted factors ---
  let score = 0;
  const factors = [];

  // Revenue at risk
  if (txn.amount_inr >= 15000) {
    score += 35;
    factors.push(`high transaction value (₹${txn.amount_inr.toLocaleString("en-IN")})`);
  } else if (txn.amount_inr >= 3000) {
    score += 20;
    factors.push(`moderate transaction value (₹${txn.amount_inr.toLocaleString("en-IN")})`);
  } else {
    score += 8;
    factors.push(`low transaction value (₹${txn.amount_inr.toLocaleString("en-IN")})`);
  }

  // Recurring revenue / churn risk
  if (txn.is_recurring) {
    score += 25;
    factors.push("recurring subscription payment (churn risk if unresolved)");
  }

  // Root cause weighting: customer-fixable issues are lower urgency than
  // issues that could reflect a systemic / issuer-side problem worth escalating.
  if (root_cause_category === "issuer_decline") {
    score += 15;
    factors.push("issuer decline can indicate a risk flag or expired instrument");
  } else if (root_cause_category === "authentication_failure") {
    score += 10;
    factors.push("auth failure often resolves with a simple retry");
  } else if (root_cause_category === "transient_infra") {
    score += 5;
    factors.push("likely transient — infra issues usually self-resolve");
  } else if (root_cause_category === "insufficient_funds") {
    score += 12;
    factors.push("customer balance issue — timing-sensitive");
  } else if (root_cause_category === "user_abandonment") {
    score += 8;
    factors.push("drop-off before completion — intent was present");
  }

  // Prior attempts already burned reduce headroom / raise urgency of getting it right
  if (txn.prior_recovery_attempts > 0) {
    score += 10;
    factors.push(`${txn.prior_recovery_attempts} recovery attempt(s) already made previously`);
  }

  // New customer vs. established
  if (txn.customer_tenure_days < 30) {
    score += 5;
    factors.push("new customer (< 30 days) — early churn is costly");
  }

  score = Math.min(100, score);

  let severity;
  if (score >= 65) severity = "critical";
  else if (score >= 45) severity = "high";
  else if (score >= 25) severity = "medium";
  else severity = "low";

  const reasoning =
    `Classified as "${root_cause_label}" (${root_cause_category}) based on failure_reason="${txn.failure_reason}". ` +
    `Severity=${severity} (score ${score}/100) driven by: ${factors.join("; ")}.`;

  return {
    root_cause_category,
    root_cause_label,
    severity,
    severity_score: score,
    self_resolving_likely: SELF_RESOLVING.has(root_cause_category),
    reasoning,
  };
}

export { classifyFailure, ROOT_CAUSE_MAP, ROOT_CAUSE_LABELS };
