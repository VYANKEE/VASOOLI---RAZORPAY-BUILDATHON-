// --- Hard policy guardrails ----------------------------------------------
// These limits are enforced in plain code, never delegated to the LLM.
// The LLM (llmAgent.js) proposes a diagnosis and an action; this module is
// the single place that can approve, cap, or override that proposal. This
// split is deliberate: the buildathon brief explicitly calls out "compliant
// escalation processes and stopping rules" and "bounded workflows with
// appropriate safeguards" — those safeguards must hold even if the model
// hallucinates, ignores instructions, or recommends something unsafe.

export const MAX_ATTEMPTS = 3;
export const MIN_ACTIONABLE_AMOUNT = 200;
export const DISCOUNT_MIN_AMOUNT = 500;
export const MAX_DISCOUNT_PCT = 15;

export const ACTIONS = {
  RETRY_LINK: "retry_payment_link",
  REMINDER: "reminder_nudge",
  DISCOUNT: "discount_offer",
  ESCALATE: "escalate_to_human",
  NO_ACTION: "no_action_needed",
};

const VALID_ACTIONS = new Set(Object.values(ACTIONS));

/**
 * Validate / override a proposed action (from the LLM or the rule engine)
 * against hard policy limits. Always returns a policy-compliant action —
 * never trusts the caller.
 *
 * @param {object} txn
 * @param {number} attemptNumber - 1-indexed attempt about to be made
 * @param {Array<{action:string}>} history - prior attempts this run
 * @param {string} proposedAction
 * @param {number|undefined} proposedDiscountPct
 */
export function enforcePolicy(txn, attemptNumber, history, proposedAction, proposedDiscountPct) {
  const totalAttemptsSoFar = txn.prior_recovery_attempts + attemptNumber - 1;
  const lastAction = history[history.length - 1]?.action;

  // Rule 1 — hard stop at MAX_ATTEMPTS, no matter what was proposed.
  if (totalAttemptsSoFar >= MAX_ATTEMPTS) {
    if (proposedAction !== ACTIONS.ESCALATE && proposedAction !== ACTIONS.NO_ACTION) {
      return {
        action: ACTIONS.ESCALATE,
        discount_pct: undefined,
        overridden: true,
        override_reason: `max_attempts_policy: ${totalAttemptsSoFar} attempts already made (cap is ${MAX_ATTEMPTS}) — forcing escalation regardless of proposal.`,
      };
    }
  }

  // Rule 2 — unknown / malformed action from the model -> safe default.
  if (!VALID_ACTIONS.has(proposedAction)) {
    return {
      action: ACTIONS.ESCALATE,
      discount_pct: undefined,
      overridden: true,
      override_reason: `invalid_action_policy: model proposed an unrecognized action ("${proposedAction}") — escalating to a human rather than executing an unvalidated action.`,
    };
  }

  // Rule 3 — no identical action twice in a row (no-spam).
  if (proposedAction === lastAction && proposedAction !== ACTIONS.ESCALATE) {
    return {
      action: ACTIONS.REMINDER === lastAction ? ACTIONS.RETRY_LINK : ACTIONS.REMINDER,
      discount_pct: undefined,
      overridden: true,
      override_reason: `no_repeat_action_policy: model proposed repeating "${proposedAction}" — substituting a different lever to avoid spamming the customer.`,
    };
  }

  // Rule 4 — discount must clear the floor, cap the percentage, and only apply once.
  if (proposedAction === ACTIONS.DISCOUNT) {
    if (txn.amount_inr < DISCOUNT_MIN_AMOUNT) {
      return {
        action: ACTIONS.REMINDER,
        discount_pct: undefined,
        overridden: true,
        override_reason: `discount_floor_policy: amount (₹${txn.amount_inr}) is below the ₹${DISCOUNT_MIN_AMOUNT} discount floor — substituting a reminder instead.`,
      };
    }
    if (history.some((h) => h.action === ACTIONS.DISCOUNT)) {
      return {
        action: ACTIONS.ESCALATE,
        discount_pct: undefined,
        overridden: true,
        override_reason: `discount_once_policy: a discount was already offered once this case — not offering a second discount, escalating instead.`,
      };
    }
    const pct = Math.min(MAX_DISCOUNT_PCT, Math.max(5, Number(proposedDiscountPct) || 10));
    return { action: ACTIONS.DISCOUNT, discount_pct: pct, overridden: false, override_reason: null };
  }

  // Rule 5 — below the actionability floor with no urgency: only allow
  // NO_ACTION or a light-touch action, never a discount/escalation on attempt 1.
  if (
    attemptNumber === 1 &&
    txn.amount_inr < MIN_ACTIONABLE_AMOUNT &&
    !txn.is_recurring &&
    (proposedAction === ACTIONS.DISCOUNT || proposedAction === ACTIONS.ESCALATE)
  ) {
    return {
      action: ACTIONS.NO_ACTION,
      discount_pct: undefined,
      overridden: true,
      override_reason: `actionability_threshold_policy: amount (₹${txn.amount_inr}) is below the ₹${MIN_ACTIONABLE_AMOUNT} floor and non-recurring — a discount/escalation is not cost-justified, withholding action instead.`,
    };
  }

  return { action: proposedAction, discount_pct: undefined, overridden: false, override_reason: null };
}
