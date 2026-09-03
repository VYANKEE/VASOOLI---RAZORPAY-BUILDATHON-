// --- One-off diagnostic: find a working NVIDIA NIM model on this account.
// Run with: node src/findModel.js
// Tries a shortlist of currently-popular chat/instruct models with a tiny
// test prompt and reports which ones actually work with your API key —
// no guessing required. Once you have a winner, put it in .env as
// NVIDIA_MODEL=<that id>.

import "./env.js";

const CANDIDATES = [
  "meta/llama-3.3-70b-instruct",
  "meta/llama-4-scout-17b-16e-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "qwen/qwen2.5-72b-instruct",
  "mistralai/mixtral-8x22b-instruct-v0.1",
  "microsoft/phi-3.5-moe-instruct",
  "google/gemma-2-27b-it",
  "deepseek-ai/deepseek-r1",
];

const URL = "https://integrate.api.nvidia.com/v1/chat/completions";

async function tryModel(model) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error("NVIDIA_API_KEY not set in server/.env — set it first.");
    process.exit(1);
  }
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with just the word OK." }],
        max_tokens: 10,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      return { model, ok: true, status: res.status, reply };
    } else {
      const body = await res.text();
      let detail = body;
      try {
        detail = JSON.parse(body).detail || JSON.parse(body).title || body;
      } catch {}
      return { model, ok: false, status: res.status, detail: String(detail).slice(0, 150) };
    }
  } catch (err) {
    return { model, ok: false, status: "network_error", detail: err.message };
  }
}

async function main() {
  console.log(`Testing ${CANDIDATES.length} candidate models against your NVIDIA_API_KEY...\n`);
  const working = [];
  for (const model of CANDIDATES) {
    process.stdout.write(`  ${model} ... `);
    const result = await tryModel(model);
    if (result.ok) {
      console.log(`✓ WORKS (replied: "${result.reply}")`);
      working.push(model);
    } else {
      console.log(`✗ ${result.status} — ${result.detail}`);
    }
  }

  console.log("");
  if (working.length > 0) {
    console.log(`Working model(s): ${working.join(", ")}`);
    console.log(`\nAdd this line to server/.env:\n  NVIDIA_MODEL=${working[0]}`);
  } else {
    console.log("None of the candidates worked. Open https://build.nvidia.com, pick any");
    console.log("chat/text model card you have access to, and copy its exact model ID");
    console.log("from the code sample shown there into NVIDIA_MODEL in server/.env.");
  }
}

main();
