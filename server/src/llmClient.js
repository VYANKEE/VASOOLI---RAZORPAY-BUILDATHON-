// --- LLM client router ----------------------------------------------------
// Supports two providers behind one interface: NVIDIA NIM and Google Gemini
// (AI Studio). Whichever API key is set in .env decides which one is used —
// GEMINI_API_KEY takes priority if both are present. This keeps llmAgent.js
// (the actual diagnosis/decision/message prompt) provider-agnostic.
//
// Design choice: this is called from an AGENT step (diagnosis + action
// recommendation + message), never for the hard safety limits (max
// attempts, discount caps, no-repeat-action) — those stay in policy.js as
// plain code specifically so they can never be talked out of by a model.

import { callGeminiJSON, geminiEnabled, resolveGeminiConfig, GEMINI_DEFAULT_MODEL } from "./geminiClient.js";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_DEFAULT_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.2-90b-vision-instruct";

// "role" distinguishes the two call sites — "pipeline" (per-transaction
// diagnosis, llmAgent.js) and "assistant" (chatbot, assistant.js). They can
// share one Gemini key (default) or use two separate ones, see
// geminiClient.js's resolveGeminiConfig. NVIDIA has no such split (single
// key today) so role only matters on the Gemini path.
function activeProvider(role = "pipeline") {
  if (geminiEnabled(role)) return "gemini";
  if (Boolean(process.env.NVIDIA_API_KEY)) return "nvidia";
  return null;
}

export function llmEnabled(role = "pipeline") {
  return activeProvider(role) !== null;
}

export const DEFAULT_MODEL =
  activeProvider() === "gemini" ? (process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL) : NVIDIA_DEFAULT_MODEL;

export function activeModelLabel() {
  const provider = activeProvider();
  if (provider === "gemini") return `Gemini: ${process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL}`;
  if (provider === "nvidia") return `NVIDIA NIM: ${NVIDIA_DEFAULT_MODEL}`;
  return null;
}

// --- Simple global rate limiter + 429 retry --------------------------
// Free-tier LLM APIs (Gemini's free tier especially) enforce a low
// requests-per-minute cap regardless of how many transactions this
// pipeline is processing concurrently. Rather than let the whole batch
// hammer the API and mostly fail with 429s, every call funnels through
// a gate that spaces requests out, and any 429 that still slips through
// is retried with backoff before being treated as a real failure.
//
// One gate PER ROLE (not one global gate): when the pipeline and the
// assistant are using two different API keys, they're hitting two
// independent quotas at Google, so there's no reason for the assistant's
// chat reply to sit in a queue behind 90+ pipeline calls it isn't
// actually competing with. When both roles share the same key (the
// default, single-key setup), each role still gets its own MIN_INTERVAL_MS
// pacing, which is a little more optimistic than one shared gate would be
// — acceptable since withRetry() below still catches and backs off any
// 429 that slips through.
const MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS || 4500); // ~13/min, under Gemini free tier's 15/min cap
const limiters = new Map(); // role -> { lastCallAt, queue }

function limiterFor(role) {
  if (!limiters.has(role)) limiters.set(role, { lastCallAt: 0, queue: Promise.resolve() });
  return limiters.get(role);
}

function scheduleSlot(role = "pipeline") {
  const state = limiterFor(role);
  const prev = state.queue;
  let release;
  state.queue = new Promise((resolve) => (release = resolve));
  return prev.then(async () => {
    const wait = Math.max(0, state.lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    state.lastCallAt = Date.now();
    release();
  });
}

async function withRetry(fn, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const is429 = /\b429\b/.test(err.message) || /RESOURCE_EXHAUSTED|rate.?limit/i.test(err.message);
      if (!is429 || attempt === retries) throw err;
      const backoffMs = 3000 * Math.pow(2, attempt); // 3s, 6s, 12s
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

/**
 * Calls whichever LLM provider is configured and expects a JSON object back.
 * Throws on any failure (network, non-2xx, bad JSON) so callers can decide
 * how to fall back — this function never silently returns a bad guess.
 * Requests are globally paced (LLM_MIN_INTERVAL_MS apart) and 429s are
 * retried with backoff, regardless of how many transactions are calling
 * this concurrently from pipeline.js.
 */
async function callLLMJSON({ system, user, maxTokens = 400, temperature = 0.4, role = "pipeline" }) {
  const provider = activeProvider(role);
  if (!provider) {
    const hint = role === "assistant" ? "GEMINI_API_KEY_ASSISTANT, GEMINI_API_KEY, or NVIDIA_API_KEY" : "GEMINI_API_KEY or NVIDIA_API_KEY";
    throw new Error(`No LLM provider configured for role "${role}" (set ${hint})`);
  }

  return withRetry(async () => {
    await scheduleSlot(role);
    if (provider === "gemini") {
      return callGeminiJSON({ system, user, maxTokens, temperature, role });
    }
    return callNvidiaJSON({ system, user, maxTokens, temperature });
  });
}

async function callNvidiaJSON({ system, user, maxTokens, temperature }) {
  const apiKey = process.env.NVIDIA_API_KEY;
  const controller = new AbortController();
  const timeoutMs = Number(process.env.NVIDIA_TIMEOUT_MS || 45000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NVIDIA NIM API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA NIM API returned no content");

  return parseJSONLoose(content);
}

// Models sometimes wrap JSON in markdown fences or add a sentence before/after.
// Pull out the first {...} block and parse that.
function parseJSONLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not locate JSON object in LLM response: ${text.slice(0, 200)}`);
  }
  const jsonSlice = candidate.slice(start, end + 1);
  return JSON.parse(jsonSlice);
}

export { callLLMJSON };
