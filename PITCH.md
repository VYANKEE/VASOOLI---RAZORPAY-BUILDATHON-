# 5-Minute Pitch Script — Vasooli

*(~780 words, timed to roughly 5 minutes at a natural speaking pace. Read it out loud once and trim pauses as needed.)*

---

**[Problem — ~40 sec]**

Every day, Indian fintech and e-commerce platforms lose a huge chunk of revenue to something almost invisible in most dashboards: payments that *almost* happened. A customer starts checkout, their OTP times out, their card gets declined, or the bank's server just hiccups for a second — and that transaction quietly dies. Industry numbers put failed and abandoned payments at ten to twenty percent of transaction volume. Most of that money isn't gone — it's recoverable, if someone reaches out at the right moment, in the right way. The hard part is doing that at scale, with real AI judgment, without spamming customers, and without a black box making decisions nobody can explain or trust later.

That's what I built for this track: **Vasooli.**

**[What I built — ~55 sec]**

Vasooli is an AI agent that takes a stream of failed or abandoned transactions, and for every single one, an actual LLM diagnoses *why* the payment failed, recommends a recovery action, and drafts the outreach message — natural Hinglish, WhatsApp-style, not robotic corporate copy. But here's the part I'm most proud of: the AI's recommendation is never executed blindly. A separate, plain-code policy engine checks every single proposal against hard compliance rules — max three attempts per customer, no repeating the same action twice, discounts capped and offered only once — and overrides the AI whenever it would break one. The AI brings judgment; the code brings guarantees. If the AI is ever unavailable, the whole thing gracefully falls back to a deterministic rule engine instead of breaking — I tested this by cutting the API key mid-run, and it kept going without dropping a single case.

**[Prove it, don't just say it — ~65 sec]**

Anyone can *claim* their AI is bounded and safe. I wanted to actually show it. Two things on the dashboard do that. First: an automated eval suite runs after every single pipeline run — not a separate script I run once for a slide, it's wired directly into the live server — and mechanically re-checks eleven compliance properties against the real audit trail. Eleven out of eleven, every time, rendered live on the landing page as it runs through the checklist.

But the part I actually want to show you live: on the Architecture page, there's a widget called **"Try to break a guardrail."** You pick a way the AI might misbehave — push past the attempt cap, repeat the same action twice, invent an action that doesn't exist, offer a forty percent discount when the cap is fifteen — and it runs that exact unsafe proposal through the real policy engine, live, on that click. You watch it get caught in real time: what the AI proposed, in red, and what the policy engine actually allowed, in green, with the exact rule that fired. That's not a mockup of a guardrail. That's the guardrail.

**[Architecture — ~50 sec]**

The system has four layers. A synthetic dataset — ninety-two realistic transaction records modeled on Indian fintech patterns. The agent loop itself, running on Gemini — for every attempt, the model gets the full case history and returns a diagnosis, a recommended action, and a message, as structured output. The policy engine, which I just showed you. And a React dashboard styled like an actual fintech ops console, where you can click into any case and see the AI's raw diagnosis, whether the policy engine overrode it, the exact message sent, and the outcome — plus a chatbot assistant that answers questions about the live run by calling real tools against real data, never guessing from memory.

**[Live metrics — ~50 sec]**

The numbers come from actually running the pipeline, not from typing them into a slide. Out of ninety-two cases, the agent hit a seventy-eight percent overall recovery rate — almost eighty-eight percent on the cases it chose to act on — recovering roughly three lakh fifteen thousand rupees out of three lakh seventy-one thousand at risk. About eleven percent of cases got a deliberate no-action decision — the agent correctly recognizing a nudge wasn't worth the friction. And ten cases got escalated to a human after hitting the attempt limit, because the agent knows when automation has run out of value.

**[What's next — ~30 sec]**

Next steps: real WhatsApp and SMS integration instead of simulated execution, a proper database instead of flat files, auth and scoped access since right now the API is wide open for demo purposes, and using the audit trail to A/B test how much lift the LLM's judgment actually adds over the rule-based baseline.

**[Close — ~20 sec]**

Vasooli isn't a demo that talks about AI revenue recovery — it's a working pipeline where a real model makes real judgment calls, a real policy layer keeps it inside hard limits, and you can walk up right now and try to break it yourself. Thank you.

---

## Demo flow checklist (what to actually click, in order)

1. **Landing page** — scroll past the hero straight to "Not a black box. Here's the real math." Point out the severity formula and the real generated WhatsApp message. This sets up "everything here is real" before anything else.
2. **Landing page, Guardrails section** — let the 11 checks visibly tick through, live.
3. **Architecture page → "Try to break a guardrail"** — this is the moment. Run 2-3 scenarios live (discount cap and max-attempts read best on camera). Narrate the red→green as it happens.
4. **Console page** — click into any case with `overridden_by_policy: true` for a real (not staged) example from the actual run.
5. **Assistant page** — ask "Which failure reason has the worst recovery rate?" live, show the tool call it made.
6. Close on the metrics strip — say the numbers out loud as they're on screen, not from memory.
