export function formatINR(amount) {
  if (amount === null || amount === undefined) return "—";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export function formatPct(v, digits = 1) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(digits)}%`;
}

export function formatHours(h) {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const FAILURE_REASON_LABELS = {
  card_declined: "Card Declined",
  insufficient_funds: "Insufficient Funds",
  checkout_timeout: "Checkout Timeout",
  otp_failed: "OTP Failed",
  network_error: "Network Error",
  bank_server_down: "Bank Server Down",
};

export const ACTION_LABELS = {
  retry_payment_link: "Retry Link",
  reminder_nudge: "Reminder Nudge",
  discount_offer: "Discount Offer",
  escalate_to_human: "Escalated",
  no_action_needed: "No Action",
};

export const STATUS_LABELS = {
  recovered: "Recovered",
  no_action: "No Action",
  escalated_pending: "Escalated",
  unresolved: "Unresolved",
};

export const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
