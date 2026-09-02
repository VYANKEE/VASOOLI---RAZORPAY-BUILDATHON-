# 5-Minute Pitch Script — Recovery Agent

*(~720 words, timed to roughly 5 minutes at a natural speaking pace. Read it out loud once and trim pauses as needed.)*

---

**[Problem — ~45 sec]**

Every day, Indian fintech and e-commerce platforms lose a huge chunk of revenue to something completely invisible in most dashboards: payments that almost happened. A customer starts checkout, their OTP times out, or their card gets declined, or the bank's server just hiccups for a second — and that transaction quietly dies. Industry numbers put failed and abandoned payments at ten to twenty percent of transaction volume. Most of that money isn't gone — it's recoverable, if someone reaches out at the right moment, in the right way. The hard part is doing that at scale, with real AI judgment, without spamming customers, and without a black box making decisions nobody can explain or trust later.

That's what I built for this track: **Recovery Agent.**

**[What I built — ~60 sec]**

Recovery Agent is an AI agent that takes a stream of failed or abandoned transactions, and for every single one, an actual LLM diagnoses *why* the payment failed, recommends a recovery action, and drafts the outreach message — natural Hinglish, WhatsApp-style, not robotic corporate copy. But here's the part I'm most proud of: the AI's recommendation is never executed blindly. A separate, plain-code policy engine checks every single proposal against hard compliance rules — max three attempts per customer, no repeating the same action twice, discounts capped and offered only once — and overrides the AI whenever it would break one. The AI brings judgment; the code brings guarantees. And if the AI is ever unavailable, the whole thing gracefully falls back to a deterministic rule engine instead of breaking — I actually tested this by cutting off network access mid-run, and it kept going without dropping a single case.

**[Architecture — ~70 sec]**

The system has four layers. First, a synthetic dataset — ninety-two realistic transaction records modeled on Indian fintech patterns: UPI, cards, netbanking, subscriptions and one-off purchases, with six real-world failure reasons. Second, the agent loop itself, running on NVIDIA's hosted LLM API — for every attempt, the model gets the full case history and returns a diagnosis, a recommended action, and a message, all as structured output. Third, the policy engine — the part that makes this safe to actually ship. It's not a suggestion to the model, it's code that runs after the model and can overrule it, and it logs exactly when and why it did. And fourth, a React dashboard styled like an actual fintech ops console, where you can click into any case and see the AI's raw diagnosis, whether the policy engine overrode it, the exact message sent, and the outcome.

**[Guardrails are proven, not claimed — ~50 sec]**

And I didn't stop at writing the guardrails — I built an automated eval suite that runs after every pipeline execution and mechanically re-checks the audit trail: did any case exceed three attempts? Did any discount go over the cap? Did anything repeat back-to-back? Eleven checks, and on every run, eleven out of eleven pass. That's not me telling you it's bounded — that's the system proving it against its own output, every single time.

**[Live metrics — ~55 sec]**

The numbers come from actually running the pipeline, not from typing them into a slide. Out of ninety-two cases, the agent hit a seventy-eight percent overall recovery rate — almost eighty-eight percent on the cases it chose to act on — recovering roughly three lakh fifteen thousand rupees out of three lakh seventy-one thousand at risk. About eleven percent of cases got a deliberate no-action decision — the agent correctly recognizing a nudge wasn't worth the friction. And ten cases got escalated to a human after hitting the attempt limit, because the agent knows when automation has run out of value.

**[What's next — ~35 sec]**

Next steps: real WhatsApp and SMS integration instead of simulated execution, a proper database instead of flat files, per-customer cooldown windows across transactions instead of just within one, and using the audit trail itself to A/B test how much lift the LLM's judgment actually adds over the rule-based baseline.

**[Close — ~15 sec]**

Recovery Agent isn't a demo that talks about AI revenue recovery — it's a working pipeline where a real model makes real judgment calls, a real policy layer keeps it inside hard limits, and every single decision is logged and independently verified. Thank you.
