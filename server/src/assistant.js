// --- AI Transaction Assistant: real tool-calling over real data ---------
// Two-hop protocol built on the same callLLMJSON used by the pipeline
// (whichever provider — Gemini or NVIDIA — is configured):
//
//   1. TOOL SELECTION — given the user's question + a fixed tool list, the
//      model picks at most one tool and its arguments (or decides no tool
//      is needed for a purely conversational question).
//   2. GROUNDED ANSWER — the tool is executed against the actual in-memory
//      pipeline state (case summaries / audit entries / metrics from this
//      run), and the model is asked to answer using ONLY that tool result.
//
// This means the assistant never has the full dataset in its prompt (it
// requests only what it needs) and never answers from parametric memory —
// every factual claim is traceable to a tool call you can see in the
// response's `tool_call` field.

import { callLLMJSON, llmEnabled } from "./llmClient.js";

const TOOLS = [
  {
    name: "get_metrics",
    description: "Get the overall computed metrics for the current pipeline run: recovery rate, amounts recovered/at-risk, false-action rate, breakdowns by failure reason/action/severity.",
    args: {},
  },
  {
    name: "search_cases",
    description: "Search/filter transaction cases. All args optional.",
    args: {
      failure_reason: "one of: card_declined, insufficient_funds, checkout_timeout, otp_failed, network_error, bank_server_down",
      severity: "one of: low, medium, high, critical",
      final_status: "one of: recovered, no_action, escalated_pending, unresolved",
      final_action: "one of: retry_payment_link, reminder_nudge, discount_offer, escalate_to_human, no_action_needed",
      min_amount: "number, minimum amount_inr",
      limit: "number, max results to return (default 10, max 25)",
      sort_by: "one of: amount_desc, amount_asc (default: amount_desc)",
    },
  },
  {
    name: "get_case_detail",
    description: "Get the full detail and complete audit trail (every attempt, AI reasoning, policy decisions) for one specific transaction by its ID.",
    args: { transaction_id: "exact transaction ID, e.g. TXN20260800017" },
  },
  {
    name: "get_pipeline_status",
    description: "Get the live status of the most recent/current pipeline run: whether it's running, how many transactions processed, LLM mode.",
    args: {},
  },
];

const TOOL_SELECTION_SYSTEM = `You are the routing layer for an AI assistant embedded in "Vasooli", a fintech revenue-recovery platform. Given the user's question and recent conversation, decide whether answering it requires calling one tool from this list, and if so with what arguments.

Available tools:
${TOOLS.map((t) => `- ${t.name}: ${t.description} Args: ${JSON.stringify(t.args)}`).join("\n")}

Rules:
- Pick at most ONE tool call per turn.
- Only include args the tool actually defines; omit args you don't need.
- If the question is purely conversational (greeting, thanks, or something no tool can answer), set tool to null.
- Never invent data yourself — that's what the tool is for.

Respond with ONLY this JSON shape:
{ "tool": "<tool name or null>", "args": { ... } }`;

const ANSWER_SYSTEM = `You are the AI assistant embedded in "Vasooli", a fintech revenue-recovery platform, talking to an ops/analyst user. You were given the result of a data tool call (or told no tool was needed). Answer the user's question using ONLY the provided tool result — never invent numbers, transaction IDs, or facts not present in it. If the tool result doesn't contain what's needed to answer, say so plainly.

Keep answers concise (2-5 sentences, or a short list) and reference specific transaction IDs when relevant so the user can look them up. Respond with ONLY this JSON shape:
{ "answer": "your reply text", "referenced_transaction_ids": ["..."] }`;

function executeTool(name, args, state) {
  const { caseSummaries, metrics } = state;
  switch (name) {
    case "get_metrics":
      return metrics;
    case "search_cases": {
      let rows = caseSummaries;
      if (args.failure_reason) rows = rows.filter((c) => c.failure_reason === args.failure_reason);
      if (args.severity) rows = rows.filter((c) => c.severity === args.severity);
      if (args.final_status) rows = rows.filter((c) => c.final_status === args.final_status);
      if (args.final_action) rows = rows.filter((c) => c.final_action === args.final_action);
      if (typeof args.min_amount === "number") rows = rows.filter((c) => c.amount_inr >= args.min_amount);
      rows = [...rows].sort((a, b) =>
        args.sort_by === "amount_asc" ? a.amount_inr - b.amount_inr : b.amount_inr - a.amount_inr
      );
      const limit = Math.min(25, Number(args.limit) || 10);
      return { total_matches: rows.length, results: rows.slice(0, limit) };
    }
    case "get_case_detail": {
      const c = caseSummaries.find((x) => x.transaction_id === args.transaction_id);
      if (!c) return { error: `No case found with transaction_id ${args.transaction_id}` };
      const audit = state.auditEntries.filter((a) => a.transaction_id === args.transaction_id);
      return { case: c, audit_trail: audit };
    }
    case "get_pipeline_status":
      return state.progress;
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Handles one assistant turn. `state` is { caseSummaries, auditEntries,
 * metrics, progress } — the server's live in-memory pipeline output.
 * Returns { answer, tool_call, tool_result, referenced_transaction_ids }.
 * Throws if the LLM is unavailable — the route handler decides the fallback.
 */
async function handleAssistantTurn(message, history, state) {
  if (!llmEnabled("assistant")) {
    throw new Error(
      "No LLM provider configured — the assistant needs GEMINI_API_KEY_ASSISTANT (or GEMINI_API_KEY) or NVIDIA_API_KEY set."
    );
  }

  const historyText = (history || [])
    .slice(-6)
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
    .join("\n");

  const selection = await callLLMJSON({
    system: TOOL_SELECTION_SYSTEM,
    user: `${historyText ? historyText + "\n" : ""}User: ${message}`,
    maxTokens: 200,
    temperature: 0.1,
    role: "assistant",
  });

  let toolResult = null;
  if (selection?.tool && TOOLS.some((t) => t.name === selection.tool)) {
    toolResult = executeTool(selection.tool, selection.args || {}, state);
  }

  const answerPayload = await callLLMJSON({
    system: ANSWER_SYSTEM,
    user: `User's question: ${message}\n\nTool called: ${selection?.tool || "none"}\nTool result:\n${JSON.stringify(toolResult, null, 2).slice(0, 6000)}`,
    maxTokens: 400,
    temperature: 0.3,
    role: "assistant",
  });

  return {
    answer: String(answerPayload?.answer || "").trim() || "I couldn't generate an answer from the available data.",
    tool_call: selection?.tool || null,
    tool_args: selection?.args || null,
    referenced_transaction_ids: Array.isArray(answerPayload?.referenced_transaction_ids)
      ? answerPayload.referenced_transaction_ids
      : [],
  };
}

export { handleAssistantTurn, TOOLS };
