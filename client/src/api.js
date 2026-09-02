const BASE = "/api";

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const api = {
  metrics: () => getJSON(`${BASE}/metrics`),
  cases: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return getJSON(`${BASE}/cases${suffix}`);
  },
  caseDetail: (transactionId) => getJSON(`${BASE}/cases/${transactionId}`),
  rerun: async () => {
    const res = await fetch(`${BASE}/run`, { method: "POST" });
    if (!res.ok) throw new Error(`rerun -> ${res.status}`);
    return res.json();
  },
};
