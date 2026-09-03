// Generates a synthetic dataset of failed/abandoned Indian fintech payments.
// Deterministic (seeded RNG) so re-running produces the same dataset, and so
// metrics reported in the README can be reproduced exactly by a judge.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mulberry32 } from "./rng.js";
import { randomName } from "./names.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "data");

const rng = mulberry32(42);

const FAILURE_REASONS = [
  "card_declined",
  "insufficient_funds",
  "checkout_timeout",
  "otp_failed",
  "network_error",
  "bank_server_down",
];

const PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Netbanking", "Wallet"];

// Weighted so the dataset feels like a real merchant's failure mix rather
// than a uniform draw (UPI + card failures dominate real-world checkout data).
const METHOD_WEIGHTS = { UPI: 0.42, "Credit Card": 0.22, "Debit Card": 0.2, Netbanking: 0.1, Wallet: 0.06 };
const REASON_WEIGHTS = {
  card_declined: 0.24,
  insufficient_funds: 0.2,
  checkout_timeout: 0.16,
  otp_failed: 0.16,
  network_error: 0.14,
  bank_server_down: 0.1,
};

function weightedPick(weights) {
  const r = rng();
  let acc = 0;
  for (const [key, w] of Object.entries(weights)) {
    acc += w;
    if (r <= acc) return key;
  }
  return Object.keys(weights)[0];
}

// A subset of transactions represent recurring subscription billing —
// these are the ones a "reminder nudge" / dunning flow is most relevant to.
const SUBSCRIPTION_PLANS = ["Basic-Monthly", "Pro-Monthly", "Pro-Annual", "Team-Monthly", "Premium-Monthly"];

function randomAmount(hasSubscription) {
  if (hasSubscription) {
    // Subscription-ish amounts: 149 - 4999
    const tiers = [149, 299, 499, 999, 1499, 2499, 4999];
    return tiers[Math.floor(rng() * tiers.length)];
  }
  // One-off checkout amounts: 199 - 45000, log-ish distribution
  const buckets = [
    [199, 999],
    [1000, 4999],
    [5000, 14999],
    [15000, 45000],
  ];
  const bucketWeights = [0.35, 0.35, 0.2, 0.1];
  const b = weightedPickArray(buckets, bucketWeights);
  const [lo, hi] = b;
  return Math.round((lo + rng() * (hi - lo)) / 10) * 10;
}

function weightedPickArray(items, weights) {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}

function randomTimestamp() {
  // Spread across the last 14 days, business-hour biased.
  const now = new Date("2026-09-02T10:00:00+05:30").getTime();
  const daysAgo = Math.floor(rng() * 14);
  const hour = 8 + Math.floor(rng() * 15); // 8am - 11pm IST
  const minute = Math.floor(rng() * 60);
  const d = new Date(now - daysAgo * 24 * 3600 * 1000);
  d.setHours(hour, minute, Math.floor(rng() * 60), 0);
  return d.toISOString();
}

function generateTransactions(count) {
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const isSubscription = rng() < 0.42;
    const failure_reason = weightedPick(REASON_WEIGHTS);
    const payment_method = weightedPick(METHOD_WEIGHTS);
    const amount = randomAmount(isSubscription);
    const row = {
      transaction_id: `TXN${String(20260800000 + i).padStart(11, "0")}`,
      customer_id: `CUST${String(1000 + i).padStart(5, "0")}`,
      customer_name: randomName(rng),
      amount_inr: amount,
      currency: "INR",
      failure_reason,
      payment_method,
      timestamp: randomTimestamp(),
      subscription_id: isSubscription
        ? `SUB${String(500 + Math.floor(rng() * 300)).padStart(4, "0")}-${SUBSCRIPTION_PLANS[Math.floor(rng() * SUBSCRIPTION_PLANS.length)]}`
        : null,
      is_recurring: isSubscription,
      // Occasionally a customer has already been retried before this record starts
      // (simulates mid-lifecycle data) -- pipeline still respects the 3-attempt cap.
      prior_recovery_attempts: rng() < 0.15 ? 1 : 0,
      customer_tenure_days: Math.floor(rng() * 900) + 1,
    };
    rows.push(row);
  }
  return rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function toCSV(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          if (v === null || v === undefined) return "";
          const s = String(v);
          return s.includes(",") ? `"${s}"` : s;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}

function main() {
  const count = 92;
  const rows = generateTransactions(count);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "transactions.json"), JSON.stringify(rows, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "transactions.csv"), toCSV(rows));
  console.log(`Generated ${rows.length} synthetic transactions -> backend/data/transactions.{json,csv}`);
}

main();
