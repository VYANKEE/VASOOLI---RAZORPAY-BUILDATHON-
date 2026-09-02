// --- LLM client: NVIDIA NIM (OpenAI-compatible) -------------------------
// Talks to https://integrate.api.nvidia.com/v1/chat/completions using
// whatever model is hosted on build.nvidia.com. No SDK dependency — Node's
// native fetch is enough for a single chat-completions call.
//
// Design choice: this is called from an AGENT step (diagnosis + action
// recommendation + message), never for the hard safety limits (max
// attempts, discount caps, no-repeat-action) — those stay in policy.js as
// plain code specifically so they can never be talked out of by a model.

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

export function llmEnabled() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

/**
 * Calls the LLM with a system + user prompt and expects a JSON object back.
 * Throws on any failure (network, non-2xx, bad JSON) so callers can decide
 * how to fall back — this function never silently returns a bad guess.
 */
async function callLLMJSON({ system, user, maxTokens = 700, temperature = 0.4 }) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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
        model: DEFAULT_MODEL,
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

export { callLLMJSON, DEFAULT_MODEL };
