// --- Execution simulation: believable probabilistic outcomes -----------
// No real payment/messaging is sent (this is a hackathon simulation layer).
// Recovery probabilities are grounded in the action taken, the diagnosed
// root cause, the attempt number (fatigue effect), and severity — not a
// flat coin flip — so the resulting metrics look like a real dunning
// funnel rather than random noise.

import { ACTIONS } from "./decide.js";

const BASE_RATES = {
  [ACTIONS.RETRY_LINK]: {
    transient_infra: 0.66,
    authentication_failure: 0.6,
    issuer_decline: 0.38,
    insufficient_funds: 0.3,
    user_abandonment: 0.4,
    default: 0.42,
  },
  [ACTIONS.REMINDER]: {
    user_abandonment: 0.46,
    insufficient_funds: 0.37,
    issuer_decline: 0.27,
    transient_infra: 0.4,
    authentication_failure: 0.35,
    default: 0.33,
  },
  [ACTIONS.DISCOUNT]: {
    default: 0.54,
  },
};

const ESCALATION_HUMAN_RECOVERY_RATE = 0.37;

function clamp01(x) {
  return Math.max(0.02, Math.min(0.97, x));
}

function simulateOutcome(txn, classification, decision, attemptNumber, rng) {
  const { root_cause_category, severity } = classification;

  if (decision.action === ACTIONS.NO_ACTION) {
    return {
      status: "no_action",
      recovered: false,
      recovered_amount: 0,
      time_to_recovery_hours: null,
      simulation_note: "Agent withheld action per policy — no execution to simulate.",
    };
  }

  if (decision.action === ACTIONS.ESCALATE) {
    const recovered = rng() < ESCALATION_HUMAN_RECOVERY_RATE;
    return {
      status: recovered ? "recovered" : "escalated_pending",
      recovered,
      recovered_amount: recovered ? txn.amount_inr : 0,
      time_to_recovery_hours: recovered ? Math.round((24 + rng() * 72) * 10) / 10 : null,
      simulation_note: recovered
        ? "Human agent follow-up (simulated) successfully recovered payment."
        : "Escalated to human queue; outcome pending at time of this run.",
    };
  }

  // Standard automated action
  const table = BASE_RATES[decision.action] ?? { default: 0.35 };
  let p = table[root_cause_category] ?? table.default;

  // Attempt fatigue: later automated attempts convert a bit less, all else equal
  if (attemptNumber === 2) p *= 0.92;
  if (attemptNumber >= 3) p *= 0.85;

  // Severity friction: harder cases convert slightly less often
  if (severity === "critical") p -= 0.04;
  else if (severity === "high") p -= 0.02;

  // Discount gives an explicit lift already baked into BASE_RATES; add a small
  // extra bump proportional to discount size to reflect real incentive effects.
  if (decision.action === ACTIONS.DISCOUNT && decision.discount_pct) {
    p += Math.min(0.08, decision.discount_pct / 200);
  }

  p = clamp01(p);
  const recovered = rng() < p;

  const time_to_recovery_hours = recovered
    ? Math.round((0.05 + rng() * (decision.action === ACTIONS.RETRY_LINK ? 1.5 : 18)) * 10) / 10
    : null;

  return {
    status: recovered ? "recovered" : "not_recovered",
    recovered,
    recovered_amount: recovered ? txn.amount_inr : 0,
    time_to_recovery_hours,
    simulation_note: `Simulated with p(recover)=${p.toFixed(2)} for action=${decision.action}, root_cause=${root_cause_category}, attempt=${attemptNumber}.`,
    p_recover: Math.round(p * 1000) / 1000,
  };
}

export { simulateOutcome };
