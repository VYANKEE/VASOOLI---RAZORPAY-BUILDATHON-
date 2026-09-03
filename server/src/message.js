// --- Recovery message generation (Hinglish, WhatsApp/SMS tone) ---------
// Natural, non-robotic Hinglish templates, varied by action + root cause,
// with the customer's first name and a short payment link/reference woven
// in so it reads like an actual ops message rather than a form letter.

import { ACTIONS } from "./decide.js";

function firstName(fullName) {
  return fullName.split(" ")[0];
}

function shortLink(txn) {
  return `rzp.link/${txn.transaction_id.slice(-6).toLowerCase()}`;
}

function amountStr(amount) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function buildMessage(txn, classification, decision) {
  const name = firstName(txn.customer_name);
  const amt = amountStr(txn.amount_inr);
  const link = shortLink(txn);
  const { root_cause_category } = classification;

  switch (decision.action) {
    case ACTIONS.RETRY_LINK: {
      if (root_cause_category === "authentication_failure") {
        return `Hi ${name}! Aapka payment of ${amt} OTP verify na hone ki wajah se complete nahi ho paya. Koi baat nahi, ye raha ek fresh link — ${link}. Bas OTP time pe enter kar dena. Kaam ho jayega 2 min mein! 🙂`;
      }
      if (root_cause_category === "transient_infra") {
        return `Hi ${name}, lagta hai network/server glitch ki wajah se aapka ${amt} ka payment fail ho gaya — aapki taraf se koi galti nahi thi! Ye naya secure link try karein: ${link}. Sorry for the hiccup!`;
      }
      return `Hi ${name}, aapka payment of ${amt} complete nahi ho saka. Fikar mat kijiye, yaha ek naya payment link hai: ${link}. Ek baar phir try kar lijiye.`;
    }
    case ACTIONS.REMINDER: {
      if (root_cause_category === "insufficient_funds") {
        return `Hi ${name}, aapka ${amt} ka payment balance issue ki wajah se pending reh gaya hai. Jab convenient ho, is link se complete kar dijiyega: ${link}. Koi rush nahi, bas reminder tha!`;
      }
      if (root_cause_category === "issuer_decline") {
        return `Hi ${name}, aapka card is baar payment allow nahi kar paya (${amt} ke liye). Aap chahein to UPI ya doosre card se try kar sakte hain: ${link}. Any help chahiye to bataiye!`;
      }
      if (root_cause_category === "user_abandonment") {
        return `Hi ${name}! Aapne checkout almost complete kar diya tha (${amt}) — bas last step reh gaya. Yahi se continue kar lijiye: ${link}. 2 minute ka kaam hai!`;
      }
      return `Hi ${name}, aapka payment of ${amt} abhi tak complete nahi hua hai. Ye link use karke aap ise complete kar sakte hain: ${link}. Kisi help ke liye reply kijiye.`;
    }
    case ACTIONS.DISCOUNT: {
      const pct = decision.discount_pct ?? 10;
      return `Hi ${name}! Hum chahte hain ki aapko koi dikkat na ho — is baar ${pct}% off ke saath complete kariye apna ${amt} ka payment: ${link} (code: SAVE${pct}). Ye offer sirf aapke liye, limited time ke liye hai!`;
    }
    case ACTIONS.ESCALATE: {
      return `[Internal note for support team]: ${name} (${txn.customer_id}) has a ${amt} payment stuck (root cause: ${classification.root_cause_label}) after ${decision.bounded_by === "max_attempts_policy" ? "multiple" : "2"} automated attempts. Please reach out personally — consider phone/call outreach.`;
    }
    case ACTIONS.NO_ACTION: {
      return `[No customer-facing message sent] — agent determined outreach is not cost-justified for this case. See reasoning in audit log.`;
    }
    default:
      return "";
  }
}

export { buildMessage };
