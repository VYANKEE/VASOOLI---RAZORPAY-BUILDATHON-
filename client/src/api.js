// In local dev, Vite's proxy (vite.config.js) forwards "/api" to the
// backend, so a bare relative path works. In production, the client and
// server are typically two separate deployed services (e.g. two Render
// services) with no such proxy — VITE_API_BASE, set at build time, points
// straight at the deployed backend's URL instead. Falls back to the
// relative path so a plain `npm run dev`/`npm run build` still works with
// no env var set.
const BASE = `${import.meta.env.VITE_API_BASE || ""}/api`;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.message || data?.error || `${url} -> ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `${url} -> ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => getJSON(`${BASE}/health`),
  metrics: () => getJSON(`${BASE}/metrics`),
  cases: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return getJSON(`${BASE}/cases${suffix}`);
  },
  caseDetail: (transactionId) => getJSON(`${BASE}/cases/${transactionId}`),
  rerun: () => postJSON(`${BASE}/run`),
  runAsync: () => postJSON(`${BASE}/run-async`),
  progress: () => getJSON(`${BASE}/progress`),
  evals: () => getJSON(`${BASE}/evals`),
  assistant: (message, history) => postJSON(`${BASE}/assistant`, { message, history }),
  guardrailScenarios: () => getJSON(`${BASE}/guardrail-scenarios`),
  guardrailStressTest: (scenario) => postJSON(`${BASE}/guardrail-stress-test`, { scenario }),
};
