// --- Live pipeline progress tracker --------------------------------------
// A tiny shared mutable object the pipeline updates as it processes
// transactions, and the API exposes read-only so the frontend can poll for
// a genuinely live view of the run — not a fake progress bar.

const state = {
  running: false,
  processed: 0,
  total: 0,
  stage: "idle", // idle | diagnosing | done
  startedAt: null,
  finishedAt: null,
  llmEnabled: false,
  recovered: 0,
  escalated: 0,
  noAction: 0,
  notRecovered: 0,
};

function startRun(total, llmEnabled) {
  state.running = true;
  state.processed = 0;
  state.total = total;
  state.stage = "diagnosing";
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.llmEnabled = llmEnabled;
  state.recovered = 0;
  state.escalated = 0;
  state.noAction = 0;
  state.notRecovered = 0;
}

function recordCase(finalStatus) {
  state.processed += 1;
  if (finalStatus === "recovered") state.recovered += 1;
  else if (finalStatus === "escalated_pending") state.escalated += 1;
  else if (finalStatus === "no_action") state.noAction += 1;
  else state.notRecovered += 1;
}

function finishRun() {
  state.running = false;
  state.stage = "done";
  state.finishedAt = new Date().toISOString();
}

function getProgress() {
  return { ...state };
}

export { startRun, recordCase, finishRun, getProgress };
