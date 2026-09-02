# 5-Minute Pitch Script — Recovery Agent

*(~700 words, timed to roughly 5 minutes at a natural speaking pace. Read it out loud once and trim pauses as needed.)*

---

**[Problem — ~45 sec]**

Every day, Indian fintech and e-commerce platforms lose a huge chunk of revenue to something completely invisible in most dashboards: payments that almost happened. A customer starts checkout, their OTP times out, or their card gets declined, or the bank's server just hiccups for a second — and that transaction quietly dies. Industry numbers put failed and abandoned payments at ten to twenty percent of transaction volume. Most of that money isn't gone — it's recoverable, if someone reaches out at the right moment, in the right way. The problem is doing that at scale, correctly, without spamming customers, and without a black box making decisions nobody can explain later.

That's what I built for this track: **Recovery Agent.**

**[What I built — ~60 sec]**

Recovery Agent is an AI agent that takes a stream of failed or abandoned transactions, and for every single one, it does four things: it diagnoses *why* the payment failed — not just the raw error code, but the actual root cause and how severe it is. It decides on *one* recovery action, chosen from a small, bounded set — a retry link, a reminder, a discount, or escalate to a human — with a hard rule of maximum three attempts per customer, no spam, ever. It generates the actual outreach message — natural Hinglish, WhatsApp-style, not robotic corporate copy. And it simulates execution and logs the outcome. Every single decision, every reasoning string, every message, every result — written to a structured audit trail. That audit trail is the heart of this project, because an agent that takes automated action on real customers and real money has to be explainable, end to end.

**[Architecture — ~70 sec]**

The system has three layers. First, a synthetic dataset — ninety-two realistic transaction records modeled on Indian fintech patterns: UPI, cards, netbanking, subscriptions and one-off purchases, with six real-world failure reasons like card declined, insufficient funds, OTP failed, and bank server down. Second, the pipeline itself — a Node.js backend that runs every transaction through an agent loop: classify, decide, message, simulate, and log — looping only while attempts remain and the last action wasn't final. That loop is bounded in two independent places in the code, because a guardrail you only enforce once isn't a guardrail you can trust. Third, a React dashboard, styled like an actual fintech ops console — Stripe or Razorpay's own internal tools, not a generic admin template — showing live KPIs, a breakdown by failure reason, action conversion rates, and a searchable audit log where you can click into any single case and see the agent's full reasoning chain, the exact message it sent, and why it made every call.

**[Live metrics — ~75 sec]**

And these numbers aren't invented — they come from actually running the pipeline. Out of ninety-two cases, the agent achieved a seventy-eight percent overall recovery rate — almost eighty-eight percent on the cases it actually chose to act on. That recovered roughly three lakh fifteen thousand rupees out of three lakh seventy-one thousand at risk. Average time to recovery was just over nine hours. And here's the number I'm proudest of: a false-action rate of about eleven percent — that's eleven percent of cases where the agent looked at a low-value, likely self-resolving failure and *correctly chose to do nothing*, rather than firing off a message that wasn't worth the friction. And ten cases got escalated to a human, because the agent hit its attempt limit and had the discipline to stop and hand off instead of guessing forever. That's not a system running unboundedly — that's a system that knows its own limits.

**[What's next — ~40 sec]**

Right now the reasoning engine is deterministic and rule-based on purpose — fully reproducible, fully auditable. The natural next step is swapping that reasoning layer for a real LLM call, which the code is already structured for — every function returns a clean reasoning string, ready to be LLM-generated behind a feature flag. Beyond that: real WhatsApp and SMS integration instead of simulated execution, a proper database instead of flat files, and a per-customer cooldown window across transactions, not just within one.

**[Close — ~15 sec]**

Recovery Agent isn't a demo that talks about revenue recovery — it's a working pipeline that ran, recovered real simulated rupees, respected its own limits, and left a paper trail for every decision it made. Thank you.
