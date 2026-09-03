// --- LLM client: Google Gemini (AI Studio) -------------------------------
// Uses Gemini's generateContent endpoint with responseMimeType set to
// application/json, which makes the model return valid JSON directly
// (no markdown-fence stripping needed, unlike the NVIDIA NIM path).

// gemini-2.0-flash-lite is the hardcoded fallback (only used if GEMINI_MODEL
// itself is unset) because it has a documented, generous free-tier quota —
// see .env.example for why gemini-2.5-flash-lite (deprecated) isn't it.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";

// The pipeline (per-transaction diagnosis) and the chatbot assistant can
// optionally run on two SEPARATE Gemini API keys (and even separate
// models) so their free-tier quotas don't share the same bucket — a busy
// pipeline run no longer starves the assistant of quota, and vice versa.
// GEMINI_API_KEY_ASSISTANT / GEMINI_MODEL_ASSISTANT are optional; when
// unset, the assistant role just falls back to the main pipeline key.
function resolveGeminiConfig(role = "pipeline") {
  if (role === "assistant" && process.env.GEMINI_API_KEY_ASSISTANT) {
    return {
      apiKey: process.env.GEMINI_API_KEY_ASSISTANT,
      model: process.env.GEMINI_MODEL_ASSISTANT || process.env.GEMINI_MODEL || DEFAULT_MODEL,
    };
  }
  return {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

function geminiEnabled(role = "pipeline") {
  return Boolean(resolveGeminiConfig(role).apiKey);
}

async function callGeminiJSON({ system, user, maxTokens = 400, temperature = 0.4, role = "pipeline" }) {
  const { apiKey, model } = resolveGeminiConfig(role);
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 60000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no content${blockReason ? ` (blocked: ${blockReason})` : ""}: ${JSON.stringify(data).slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // Fallback in case responseMimeType wasn't honored for some model.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
    throw new Error(`Could not parse Gemini JSON response: ${text.slice(0, 200)}`);
  }
}

export { callGeminiJSON, geminiEnabled, resolveGeminiConfig, DEFAULT_MODEL as GEMINI_DEFAULT_MODEL };
