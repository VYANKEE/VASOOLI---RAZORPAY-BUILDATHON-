// --- LLM agent step: diagnosis + action recommendation + message --------
// One call per attempt. The model sees the transaction, the classification
// inputs, and the history of what's already been tried on this case, and
// returns a single JSON verdict. Its recommended action is NEVER executed
// directly — policy.js validates/overrides it first (see policy.js header).

import { callLLMJSON, llmEnabled } from "./llmClient.js";
import { ACTIONS } from "./policy.js";

const SYSTEM_PROMPT = `You are the reasoning core of "Recovery Agent", an AI system used by an Indian fintech company to recover revenue from failed payments and abandoned checkouts.

For every case you are given the transaction details and the history of recovery attempts already made. You must:
1. Diagnose the root cause category and severity.
2. Recommend exactly ONE recovery action from this fixed list: "retry_payment_link", "reminder_nudge", "discount_offer", "escalate_to_human", "no_action_needed".
3. Write the actual customer-facing message in natural, warm Hinglish (Hindi+English mix, WhatsApp/SMS tone) — unless the action is "escalate_to_human" or "no_action_needed", in which case write a short internal note instead.

Hard rules you must respect in your recommendation (a separate system will still double-check and can override you):
- Never recommend repeating the exact same action that was just tried.
- Only recommend "discount_offer" if the amount is meaningful (do not discount trivial amounts) and no discount has been offered yet on this case.
- If attempts are already at the limit, recommend "escalate_to_human".
- If the amount is very small and the failure looks like a one-off/transient glitch, it's OK to recommend "no_action_needed" — don't message customers for tiny amounts unnecessarily.

Respond with ONLY a JSON object, no prose outside it, in this exact shape:
{
  "root_cause_category": "issuer_decline" | "insufficient_funds" | "user_abandonment" | "authentication_failure" | "transient_infra" | "other",
  "root_cause_label": "short human-readable label",
  "severity": "low" | "medium" | "high" | "critical",
  "diagnosis_reasoning": "2-3 sentences explaining the diagnosis and severity, referencing specific facts from the case",
  "recommended_action": "one of the five action keys above",
  "decision_reasoning": "2-3 sentences explaining why this action, referencing the attempt number and history",
  "discount_pct": number or null (only if recommending discount_offer, 5-15),
  "message": "the actual message text to send (Hinglish) or internal note"
}`;

function buildUserPrompt(txn, attemptNumber, history) {
  const historyText =
    history.length === 0
      ? "No prior attempts on this case."
      : history
          .map((h, i) => `Attempt ${i + 1}: action="${h.action}", outcome="${h.outcome}"`)
          .join("\n");

  return `Case details:
- Transaction ID: ${txn.transaction_id}
- Customer: ${txn.customer_name} (tenure: ${txn.customer_tenure_days} days)
- Amount: ₹${txn.amount_inr} (${txn.currency})
- Payment method: ${txn.payment_method}
- Failure reason (raw): ${txn.failure_reason}
- Is recurring subscription: ${txn.is_recurring} ${txn.subscription_id ? `(${txn.subscription_id})` : ""}
- Prior recovery attempts before this run: ${txn.prior_recovery_attempts}
- This is attempt number: ${attemptNumber} (hard max: 3 total attempts including prior ones)

Recovery history so far this run:
${historyText}

Diagnose the root cause, recommend the single best next action, and write the message. Respond with ONLY the JSON object.`;
}

/**
 * Runs one LLM agent turn for a single recovery attempt.
 * Throws if the LLM is unavailable/misbehaves — callers should catch and
 * fall back to the deterministic rule engine (classify.js/decide.js/message.js).
 */
async function runLLMTurn(txn, attemptNumber, history) {
  if (!llmEnabled()) throw new Error("LLM not enabled (NVIDIA_API_KEY not set)");

  const result = await callLLMJSON({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(txn, attemptNumber, history),
  });

  // Basic shape validation — if the model returns garbage, treat it as a failure
  // so the caller falls back rather than trusting a malformed verdict.
  if (!result || typeof result !== "object" || !result.recommended_action || !result.message) {
    throw new Error(`LLM returned malformed verdict: ${JSON.stringify(result).slice(0, 200)}`);
  }

  return {
    root_cause_category: result.root_cause_category || "other",
    root_cause_label: result.root_cause_label || "Unclassified",
    severity: ["low", "medium", "high", "critical"].includes(result.severity) ? result.severity : "medium",
    diagnosis_reasoning: String(result.diagnosis_reasoning || "").trim(),
    recommended_action: result.recommended_action,
    decision_reasoning: String(result.decision_reasoning || "").trim(),
    discount_pct: typeof result.discount_pct === "number" ? result.discount_pct : undefined,
    message: String(result.message || "").trim(),
    source: "llm",
  };
}

export { runLLMTurn, ACTIONS };
