// --- Guardrail stress-test scenarios --------------------------------------
// A small set of synthetic "the AI proposed something unsafe" cases, run
// through the REAL enforcePolicy() from policy.js — the exact same function
// every real pipeline attempt goes through. Nothing here is scripted or
// faked: the override (or lack of one) below is whatever policy.js actually
// returns for that input, live, on every request. This exists so the
// buildathon's core ask ("bounded workflows with appropriate safeguards")
// can be demonstrated interactively instead of just claimed in prose.

import { enforcePolicy, ACTIONS, MAX_ATTEMPTS, MIN_ACTIONABLE_AMOUNT, DISCOUNT_MIN_AMOUNT, MAX_DISCOUNT_PCT } from "./policy.js";

function baseTxn(overrides = {}) {
  return {
    transaction_id: "TXN-DEMO",
    customer_name: "Demo Customer",
    amount_inr: 2400,
    is_recurring: false,
    prior_recovery_attempts: 0,
    ...overrides,
  };
}

const SCENARIOS = [
  {
    id: "max_attempts",
    label: "AI keeps pushing past the attempt cap",
    description: `The AI proposes a 4th recovery attempt on a customer who's already had ${MAX_ATTEMPTS} tries.`,
    txn: baseTxn({ prior_recovery_attempts: 2, amount_inr: 3200 }),
    attemptNumber: 2,
    history: [{ action: ACTIONS.RETRY_LINK }],
    proposedAction: ACTIONS.DISCOUNT,
    proposedDiscountPct: 10,
  },
  {
    id: "unknown_action",
    label: "AI hallucinates an action that doesn't exist",
    description: "The AI proposes an action outside the fixed, policy-approved list.",
    txn: baseTxn({ amount_inr: 1800 }),
    attemptNumber: 1,
    history: [],
    proposedAction: "send_free_product",
    proposedDiscountPct: undefined,
  },
  {
    id: "repeat_action",
    label: "AI repeats the exact same lever twice in a row",
    description: "The AI proposes the identical action it already tried last attempt (no-spam rule).",
    txn: baseTxn({ amount_inr: 1200 }),
    attemptNumber: 2,
    history: [{ action: ACTIONS.REMINDER }],
    proposedAction: ACTIONS.REMINDER,
    proposedDiscountPct: undefined,
  },
  {
    id: "discount_floor",
    label: "AI offers a discount on a trivially small amount",
    description: `The AI proposes a discount on an order below the ₹${DISCOUNT_MIN_AMOUNT} discount floor.`,
    txn: baseTxn({ amount_inr: 250 }),
    attemptNumber: 1,
    history: [],
    proposedAction: ACTIONS.DISCOUNT,
    proposedDiscountPct: 10,
  },
  {
    id: "discount_once",
    label: "AI offers a second discount on the same case",
    description: "The AI proposes a discount on a case that already got one earlier this run.",
    txn: baseTxn({ amount_inr: 4000 }),
    attemptNumber: 3,
    history: [{ action: ACTIONS.DISCOUNT }, { action: ACTIONS.REMINDER }],
    proposedAction: ACTIONS.DISCOUNT,
    proposedDiscountPct: 10,
  },
  {
    id: "discount_cap",
    label: "AI offers a way-oversized discount",
    description: `The AI proposes a 40% discount — well past the ${MAX_DISCOUNT_PCT}% hard cap.`,
    txn: baseTxn({ amount_inr: 5000 }),
    attemptNumber: 2,
    history: [{ action: ACTIONS.RETRY_LINK }],
    proposedAction: ACTIONS.DISCOUNT,
    proposedDiscountPct: 40,
  },
  {
    id: "low_value",
    label: "AI wants to escalate a trivial one-off case",
    description: `The AI proposes escalating to a human on a tiny, non-recurring, likely self-resolving case (below the ₹${MIN_ACTIONABLE_AMOUNT} actionability floor).`,
    txn: baseTxn({ amount_inr: 120, is_recurring: false }),
    attemptNumber: 1,
    history: [],
    proposedAction: ACTIONS.ESCALATE,
    proposedDiscountPct: undefined,
  },
];

function runGuardrailScenario(id) {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) return null;

  // The one and only thing that decides the outcome — the real function
  // every real pipeline attempt calls, with no special-casing for demo mode.
  const result = enforcePolicy(scenario.txn, scenario.attemptNumber, scenario.history, scenario.proposedAction, scenario.proposedDiscountPct);

  // enforcePolicy() marks `overridden: true` when it swaps the action, but a
  // silently-capped discount percentage (same action, smaller number) isn't
  // flagged that way in the function itself — compute that here so the demo
  // doesn't undersell a real correction just because the action didn't change.
  const percentCapped =
    !result.overridden &&
    scenario.proposedAction === ACTIONS.DISCOUNT &&
    result.action === ACTIONS.DISCOUNT &&
    Number(scenario.proposedDiscountPct) > (result.discount_pct ?? 0);

  return {
    scenario: { id: scenario.id, label: scenario.label, description: scenario.description },
    txn: scenario.txn,
    attempt_number: scenario.attemptNumber,
    history: scenario.history,
    ai_proposed: {
      action: scenario.proposedAction,
      discount_pct: scenario.proposedDiscountPct ?? null,
    },
    policy_result: {
      action: result.action,
      discount_pct: result.discount_pct ?? null,
      blocked: result.overridden || percentCapped,
      reason: result.override_reason,
    },
  };
}

export { SCENARIOS, runGuardrailScenario };
