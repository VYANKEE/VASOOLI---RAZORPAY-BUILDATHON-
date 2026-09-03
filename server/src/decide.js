// --- Decision engine: choose a bounded recovery action -----------------
//
// Hard policy limits enforced here (these are the "non-negotiables"):
//   1. MAX_ATTEMPTS = 3 recovery attempts per customer, full stop.
//   2. No repeated identical action twice in a row (no spam).
//   3. Discounts are capped, only offered once, and never on trivially
//      small amounts (not worth the margin hit).
//   4. Below a minimum value threshold with a self-resolving root cause,
//      the agent explicitly chooses NOT to act — logged, not silent.
//   5. If attempts are exhausted without recovery, the case is escalated
//      to a human or closed — the agent never "guesses" indefinitely.

// Shared with the LLM path so both engines are bounded by the exact same
// numbers — see policy.js for why these live in one place.
import { MAX_ATTEMPTS, MIN_ACTIONABLE_AMOUNT, DISCOUNT_MIN_AMOUNT, MAX_DISCOUNT_PCT, ACTIONS } from "./policy.js";
export { MAX_ATTEMPTS, MIN_ACTIONABLE_AMOUNT, DISCOUNT_MIN_AMOUNT, MAX_DISCOUNT_PCT, ACTIONS };

/**
 * Decide the next recovery action for a transaction, given classification
 * output and the history of actions already attempted in this session.
 *
 * @param {object} txn - the transaction record
 * @param {object} classification - output of classifyFailure()
 * @param {number} attemptNumber - 1-indexed attempt about to be made
 * @param {Array} history - prior {action, outcome} for this transaction in this run
 */
function decideAction(txn, classification, attemptNumber, history) {
  const { root_cause_category, severity, self_resolving_likely } = classification;
  const priorActions = history.map((h) => h.action);
  const lastAction = priorActions[priorActions.length - 1];

  // --- Guard: hard stop at MAX_ATTEMPTS -------------------------------
  const totalAttemptsSoFar = txn.prior_recovery_attempts + attemptNumber - 1;
  if (totalAttemptsSoFar >= MAX_ATTEMPTS) {
    return {
      action: ACTIONS.ESCALATE,
      reasoning: `Stopping rule triggered: ${totalAttemptsSoFar} attempts already made (max ${MAX_ATTEMPTS} per customer, no-spam policy). Escalating to a human agent rather than continuing to retry.`,
      bounded_by: "max_attempts_policy",
    };
  }

  // --- Guard: don't bother acting on trivial, likely self-resolving cases
  if (
    attemptNumber === 1 &&
    self_resolving_likely &&
    txn.amount_inr < MIN_ACTIONABLE_AMOUNT &&
    !txn.is_recurring
  ) {
    return {
      action: ACTIONS.NO_ACTION,
      reasoning: `Root cause "${root_cause_category}" is typically transient and self-resolving, amount (₹${txn.amount_inr}) is below the ₹${MIN_ACTIONABLE_AMOUNT} actionability threshold, and this is not a recurring subscription. Agent deliberately withholds action — the expected recovery lift does not justify the cost/friction of messaging the customer. Case closed as no-action.`,
      bounded_by: "actionability_threshold",
    };
  }

  // --- Attempt 1: pick the lightest-touch action matched to root cause
  if (attemptNumber === 1) {
    if (root_cause_category === "transient_infra" || root_cause_category === "authentication_failure") {
      return {
        action: ACTIONS.RETRY_LINK,
        reasoning: `Root cause "${root_cause_category}" is usually resolved by a straightforward retry (network/OTP hiccup). Sending an immediate retry payment link is the lowest-friction, highest-expected-value first move.`,
        bounded_by: null,
      };
    }
    if (root_cause_category === "insufficient_funds") {
      return {
        action: ACTIONS.REMINDER,
        reasoning: `Insufficient funds is a timing issue on the customer's side. A gentle reminder giving them a window to top up their account is more effective and less pushy than an immediate retry or discount.`,
        bounded_by: null,
      };
    }
    if (root_cause_category === "issuer_decline") {
      return {
        action: ACTIONS.REMINDER,
        reasoning: `Issuer decline may reflect a risk flag or an outdated card. A reminder nudging the customer to retry with an alternate payment method is the safest first step before offering any incentive.`,
        bounded_by: null,
      };
    }
    if (root_cause_category === "user_abandonment") {
      return {
        action: ACTIONS.REMINDER,
        reasoning: `Customer had checkout intent but the session timed out. A prompt reminder to complete checkout, before intent decays, is the highest-conversion first move.`,
        bounded_by: null,
      };
    }
    // Fallback
    return {
      action: ACTIONS.REMINDER,
      reasoning: `No specific playbook matched root cause "${root_cause_category}"; defaulting to a generic reminder nudge as the safest first action.`,
      bounded_by: null,
    };
  }

  // --- Attempt 2: escalate the lever, but stay bounded and non-repetitive
  if (attemptNumber === 2) {
    if (lastAction === ACTIONS.RETRY_LINK) {
      // A second raw retry rarely helps more than the first; add a reminder framing instead.
      return {
        action: ACTIONS.REMINDER,
        reasoning: `First retry link did not convert. Avoiding a repeat of the same action (no-spam policy) — switching to a reminder nudge that also surfaces support contact, in case the underlying issue is not actually transient.`,
        bounded_by: "no_repeat_action_policy",
      };
    }
    if (txn.amount_inr >= DISCOUNT_MIN_AMOUNT && (severity === "high" || severity === "critical" || txn.is_recurring)) {
      // Scale the offer with how much is actually at stake, still hard-capped
      // by policy.js's MAX_DISCOUNT_PCT — a critical, recurring case earns a
      // bigger nudge than a merely "high" one-off, instead of one flat number.
      let pct = 8;
      if (severity === "high") pct += 2;
      if (severity === "critical") pct += 5;
      if (txn.is_recurring) pct += 2;
      pct = Math.min(MAX_DISCOUNT_PCT, pct);
      return {
        action: ACTIONS.DISCOUNT,
        reasoning: `First nudge did not convert. Transaction value (₹${txn.amount_inr}) clears the ₹${DISCOUNT_MIN_AMOUNT} discount floor and severity is ${severity}, so a bounded ${pct}% one-time discount (capped at ${MAX_DISCOUNT_PCT}%) is offered to close the deal. This is a one-time offer — not repeated.`,
        bounded_by: "discount_cap_policy",
        discount_pct: pct,
      };
    }
    return {
      action: ACTIONS.RETRY_LINK,
      reasoning: `First reminder did not convert and the case does not clear the discount floor (₹${DISCOUNT_MIN_AMOUNT}) or severity bar. Sending a fresh retry link as a low-cost second nudge before considering escalation.`,
      bounded_by: null,
    };
  }

  // --- Attempt 3 (final): resolve or hand off, never loop further
  if (severity === "critical" || severity === "high" || txn.is_recurring) {
    return {
      action: ACTIONS.ESCALATE,
      reasoning: `Two prior recovery attempts failed. Given severity=${severity}${txn.is_recurring ? " and this is a recurring subscription" : ""}, this is escalated to a human agent for personal outreach rather than attempting a third automated nudge — automation has exhausted its expected value here.`,
      bounded_by: "final_attempt_policy",
    };
  }
  return {
    action: ACTIONS.NO_ACTION,
    reasoning: `Two prior recovery attempts failed. Severity is ${severity} and value is below the escalation bar, so further automated or human follow-up is not cost-justified. Case is closed as unresolved rather than continuing to retry indefinitely.`,
    bounded_by: "final_attempt_policy",
  };
}

export { decideAction };
