import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  GitBranch,
  MessageSquare,
  FileSearch,
  Layers,
  Ban,
  Calculator,
  ListChecks,
  Dice5,
} from "lucide-react";
import { api } from "../api.js";
import { useReveal } from "../hooks/useReveal.js";
import { formatINR, formatPct } from "../format.js";
import WordReveal from "../components/WordReveal.jsx";
import Marquee from "../components/Marquee.jsx";
import GuardrailEvals from "../components/GuardrailEvals.jsx";
import CoinStack from "../components/CoinStack.jsx";
import LiveMessageExample from "../components/LiveMessageExample.jsx";

// Shared 3D tilt-on-hover for glass cards, subtle, pointer-driven,
// reset on leave. Cards opt in with className="tilt" and these handlers.
function handleTilt(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width - 0.5;
  const py = (e.clientY - rect.top) / rect.height - 0.5;
  el.style.setProperty("--ry", `${px * 9}deg`);
  el.style.setProperty("--rx", `${-py * 9}deg`);
}
function resetTilt(e) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
}

export default function Landing() {
  const scopeRef = useReveal();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;
    // Retry until the server has finished its first pipeline run (it
    // responds 503 with progress until then) so the live stats on this
    // page don't just silently stay empty forever if it's visited early.
    function tryFetch() {
      api
        .metrics()
        .then((m) => {
          if (!cancelled) setMetrics(m);
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(tryFetch, 3000);
        });
    }
    tryFetch();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={scopeRef}>
      <Hero metrics={metrics} />
      <Marquee />
      <ProblemSolution />
      <StatsStrip metrics={metrics} />
      <HowItWorks />
      <HowScoringWorks />
      <Guardrails />
      <WhyDifferent />
      <Scope />
      <Capabilities />
      <CTA />
    </div>
  );
}

/* ---------------------------------------------------------------- Hero */
function Hero({ metrics }) {
  return (
    <section
      style={{
        position: "relative",
        paddingTop: 130,
        paddingBottom: 110,
        overflow: "hidden",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Floating glass cards, layered depth, echoing the "live account
          card" motif. Every number shown is real, pulled from metrics. */}
      {metrics && (
        <div
          className="surface reveal tilt"
          onMouseMove={handleTilt}
          onMouseLeave={resetTilt}
          style={{
            position: "absolute",
            top: 96,
            right: "max(24px, calc(50% - 600px))",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transitionDelay: "0.35s",
            transform: "rotate(-2deg)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg, var(--accent-strong), var(--accent-dim))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={17} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{formatPct(metrics.recovery_rate_pct)}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>live recovery rate</div>
          </div>
        </div>
      )}

      {metrics && (
        <div
          className="surface reveal tilt"
          onMouseMove={handleTilt}
          onMouseLeave={resetTilt}
          style={{
            position: "absolute",
            bottom: 64,
            left: "max(24px, calc(50% - 610px))",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            transitionDelay: "0.45s",
            transform: "rotate(2deg)",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0, boxShadow: "0 0 12px var(--green)" }} />
          <div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{metrics.total_cases} cases</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>audited, every one</div>
          </div>
        </div>
      )}

      {/* Floating pixel-coin motif: money quite literally coming back. */}
      <CoinStack />

      <div className="container" style={{ position: "relative", textAlign: "center" }}>
        <WordReveal
          as="h1"
          className="editorial"
          style={{
            fontSize: "clamp(42px, 7.4vw, 92px)",
            lineHeight: 1.08,
            marginBottom: 24,
          }}
          parts={[
            { text: "Payments fail." },
            { break: true },
            { text: "Vasooli", gradient: true },
            { text: " gets them back." },
          ]}
        />

        <p
          className="reveal"
          style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            maxWidth: 620,
            margin: "0 auto 44px",
            transitionDelay: "0.12s",
          }}
        >
          An AI agent that diagnoses failed payments and abandoned checkouts, takes one bounded
          recovery action, and logs every decision it makes. Reviewed, capped, and provably
          compliant. Not a black box.
        </p>

        <div className="reveal" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", transitionDelay: "0.18s" }}>
          <Link to="/console" className="btn btn-primary">
            Open the Console <ArrowRight size={15} />
          </Link>
          <Link to="/architecture" className="btn btn-ghost">
            See the architecture
          </Link>
        </div>

        {metrics && (
          <div
            className="reveal"
            style={{
              marginTop: 68,
              display: "flex",
              justifyContent: "center",
              gap: 48,
              flexWrap: "wrap",
              transitionDelay: "0.24s",
            }}
          >
            <HeroStat label="Recovery rate" value={formatPct(metrics.recovery_rate_pct)} />
            <HeroStat label="Recovered" value={formatINR(metrics.total_recovered_inr)} />
            <HeroStat label="Cases audited" value={metrics.total_cases} />
            <HeroStat label="Built for" value="Razorpay Buildathon" small />
          </div>
        )}
      </div>
    </section>
  );
}

function HeroStat({ label, value, small }) {
  return (
    <div style={{ textAlign: "left" }}>
      <div className={small ? "" : "mono"} style={{ fontSize: small ? 16 : 24, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* -------------------------------------------------------- ProblemSolution */
function ProblemSolution() {
  const steps = ["Raw Transaction", "Signals", "Patterns", "Risk Intelligence", "AI Reasoning", "Decision", "Explanation"];
  return (
    <section style={{ padding: "100px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="container">
        <div style={{ maxWidth: 680, marginBottom: 56 }}>
          <Eyebrow>The problem</Eyebrow>
          <WordReveal
            as="h2"
            style={{ fontSize: 34, marginBottom: 16 }}
            parts={[{ text: "10 to 20% of transaction volume fails silently, and most of it is recoverable." }]}
          />
          <p className="reveal" style={{ fontSize: 15.5, color: "var(--text-secondary)", lineHeight: 1.7, transitionDelay: "0.1s" }}>
            Card declines, OTP timeouts, insufficient funds, flaky bank infra: each failure looks the
            same in a raw event log. Recovering that revenue means diagnosing the real cause, choosing
            the right lever, and knowing exactly when to stop and hand off to a human.
          </p>
        </div>

        <div className="reveal" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0, justifyContent: "center" }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={i === steps.length - 1 ? "" : "glass"}
                style={{
                  padding: "12px 20px",
                  borderRadius: 999,
                  border: i === steps.length - 1 ? "1px solid var(--accent-soft-border)" : undefined,
                  background: i === steps.length - 1 ? "var(--accent-soft)" : undefined,
                  color: i === steps.length - 1 ? "var(--accent-strong)" : "var(--text-primary)",
                  fontSize: 13.5,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {s}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight size={16} color="var(--text-tertiary)" style={{ margin: "0 10px", flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Stats */
function StatsStrip({ metrics }) {
  if (!metrics) return null;
  const items = [
    { label: "Total at risk", value: formatINR(metrics.total_at_risk_inr) },
    { label: "Recovered", value: formatINR(metrics.total_recovered_inr) },
    { label: "Avg. time to recovery", value: `${metrics.avg_time_to_recovery_hours ?? "N/A"}h` },
    { label: "False-action rate", value: formatPct(metrics.false_action_rate_pct) },
  ];
  return (
    <section style={{ padding: "40px 0 80px" }}>
      <div className="container">
        <div className="reveal surface" style={{ padding: "40px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
          {items.map((it) => (
            <div key={it.label} style={{ textAlign: "center" }}>
              <div className="mono text-gradient" style={{ fontSize: 30, fontWeight: 700 }}>{it.value}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 6 }}>{it.label}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--text-tertiary)" }}>
          Live numbers from the most recent pipeline run, not invented.{" "}
          <Link to="/console" style={{ color: "var(--accent-strong)" }}>View full dashboard →</Link>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- HowItWorks */
function HowItWorks() {
  const stages = [
    { icon: <FileSearch size={18} />, title: "Ingestion", desc: "A failed or abandoned transaction enters the pipeline with its failure reason, amount, channel and history." },
    { icon: <Sparkles size={18} />, title: "AI diagnosis", desc: "A live LLM (Gemini or NVIDIA NIM) reads the case and diagnoses the true root cause and severity, not just the raw error code." },
    { icon: <GitBranch size={18} />, title: "Policy guardrails", desc: "A separate plain-code layer validates the AI's recommended action against hard limits: max 3 attempts, no repeats, capped discounts. It can override the model." },
    { icon: <MessageSquare size={18} />, title: "Recovery message", desc: "A natural Hinglish, WhatsApp-style message is generated for the approved action, or an internal note if the case is escalated." },
    { icon: <ShieldCheck size={18} />, title: "Audit + evals", desc: "Every decision, override, and outcome is logged. An automated eval suite re-verifies the guardrails held on every run." },
  ];

  return (
    <section id="how-it-works" style={{ padding: "100px 0", borderBottom: "1px solid var(--border)", scrollMarginTop: 90 }}>
      <div className="container">
        <div style={{ marginBottom: 56, maxWidth: 640 }}>
          <Eyebrow>How it works</Eyebrow>
          <WordReveal as="h2" style={{ fontSize: 34 }} parts={[{ text: "One bounded loop, five real steps." }]} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {stages.map((s, i) => (
            <div
              key={s.title}
              className="reveal surface tilt"
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
              style={{ padding: 24, transitionDelay: `${i * 0.05}s` }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                {s.icon}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Step {i + 1}</div>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <LiveMessageExample />
      </div>
    </section>
  );
}

/* -------------------------------------------------------- HowScoringWorks */
// The exact logic from server/src/classify.js, decide.js and simulate.js,
// written out plainly. No number here is invented for the pitch — every
// weight, threshold and rate is copied straight from the code that runs.
function HowScoringWorks() {
  const severityFactors = [
    { label: "Transaction value ≥ ₹15,000", weight: "+35" },
    { label: "Transaction value ₹3,000–₹15,000", weight: "+20" },
    { label: "Transaction value < ₹3,000", weight: "+8" },
    { label: "Recurring subscription (churn risk)", weight: "+25" },
    { label: "Root cause: issuer decline", weight: "+15" },
    { label: "Root cause: insufficient funds", weight: "+12" },
    { label: "Root cause: OTP / auth failure", weight: "+10" },
    { label: "Root cause: checkout abandonment", weight: "+8" },
    { label: "Root cause: transient network/infra glitch", weight: "+5" },
    { label: "Prior recovery attempts already made", weight: "+10" },
    { label: "New customer (< 30 days tenure)", weight: "+5" },
  ];

  const bands = [
    { name: "Low", range: "0–24" },
    { name: "Medium", range: "25–44" },
    { name: "High", range: "45–64" },
    { name: "Critical", range: "65–100" },
  ];

  const recoveryRates = [
    { action: "Retry link, after an auth/OTP failure", rate: "~60%" },
    { action: "Retry link, after a transient infra glitch", rate: "~66%" },
    { action: "Retry link, after an issuer decline", rate: "~38%" },
    { action: "Reminder, after checkout abandonment", rate: "~46%" },
    { action: "Reminder, after insufficient funds", rate: "~37%" },
    { action: "Discount offer (baseline)", rate: "~54%" },
    { action: "Escalated to a human agent", rate: "~37%" },
  ];

  return (
    <section style={{ padding: "100px 0", borderBottom: "1px solid var(--border)", background: "var(--bg-sunken)" }}>
      <div className="container">
        <div style={{ marginBottom: 48, maxWidth: 680 }}>
          <Eyebrow>Under the hood</Eyebrow>
          <WordReveal as="h2" style={{ fontSize: 34, marginBottom: 12 }} parts={[{ text: "Not a black box. Here's the real math." }]} />
          <p className="reveal" style={{ fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.7, transitionDelay: "0.05s" }}>
            Every weight, threshold and rate below is copied straight from the pipeline's own code (
            <span className="mono" style={{ fontSize: 12.5 }}>classify.js</span>,{" "}
            <span className="mono" style={{ fontSize: 12.5 }}>decide.js</span>,{" "}
            <span className="mono" style={{ fontSize: 12.5 }}>simulate.js</span>), not simplified for this page.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {/* 1. Severity scoring */}
          <div className="reveal surface" style={{ padding: 24 }}>
            <SectionIcon icon={<Calculator size={17} />} />
            <h3 style={{ fontSize: 15.5, marginBottom: 4 }}>1. Severity score, out of 100</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 14, lineHeight: 1.55 }}>
              Every case starts at 0. Explainable, weighted factors add points; the total decides urgency.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {severityFactors.map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                  <span className="mono" style={{ color: "var(--accent-strong)", fontWeight: 700, flexShrink: 0 }}>{f.weight}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              {bands.map((b) => (
                <span key={b.name} className="mono glass" style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, color: "var(--text-tertiary)" }}>
                  {b.name} {b.range}
                </span>
              ))}
            </div>
          </div>

          {/* 2. Decision playbook */}
          <div className="reveal surface" style={{ padding: 24, transitionDelay: "0.05s" }}>
            <SectionIcon icon={<ListChecks size={17} />} />
            <h3 style={{ fontSize: 15.5, marginBottom: 4 }}>2. Which action gets picked</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 14, lineHeight: 1.55 }}>
              A fixed, bounded playbook — never more than 3 attempts per customer, ever.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PlaybookStep n={1} text="Matched to the root cause: an infra glitch or OTP failure gets an instant retry link; funds, issuer or abandonment issues get a reminder first." />
              <PlaybookStep n={2} text="Never repeats attempt 1's action (no-spam rule). Offers a one-time discount (max 15%, only above ₹500) if severity is high/critical or it's a subscription — otherwise another light nudge." />
              <PlaybookStep n={3} text="Final attempt: escalates to a human if severity is high/critical or recurring; otherwise the case closes as unresolved. It never keeps retrying indefinitely." last />
            </div>
          </div>

          {/* 3. Simulated outcome */}
          <div className="reveal surface" style={{ padding: 24, transitionDelay: "0.1s" }}>
            <SectionIcon icon={<Dice5 size={17} />} />
            <h3 style={{ fontSize: 15.5, marginBottom: 4 }}>3. Whether it actually recovers</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
              No live payment gateway is wired up (see Scope below), so this one step is a <strong>simulation</strong>,
              not a real payment result — grounded in realistic conversion rates per action and root cause, not a coin flip:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
              {recoveryRates.map((r) => (
                <div key={r.action} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{r.action}</span>
                  <span className="mono" style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>{r.rate}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", paddingTop: 12, borderTop: "1px solid var(--border)", lineHeight: 1.55 }}>
              Later attempts on the same case convert a little less each time (fatigue is built into the model), and
              every simulated roll is logged with its exact probability in the audit trail — checkable, not hidden.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionIcon({ icon }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: "var(--accent-soft)",
        color: "var(--accent-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
      }}
    >
      {icon}
    </div>
  );
}

function PlaybookStep({ n, text, last }) {
  return (
    <div style={{ display: "flex", gap: 10, paddingBottom: last ? 0 : 12, borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div
        className="mono"
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------ Guardrails */
function Guardrails() {
  return (
    <section className="section-dark" style={{ padding: "120px 0" }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center" }}>
        <div>
          <div className="reveal" style={{ fontSize: 12.5, fontWeight: 600, color: "#7fa1ff", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 18 }}>
            Why the AI doesn't hold the safety limits
          </div>
          <h2 className="reveal editorial" style={{ fontSize: "clamp(32px, 4vw, 46px)", lineHeight: 1.15, marginBottom: 22, color: "#f4f6fa", transitionDelay: "0.05s" }}>
            The model proposes.
            <br />
            Code decides what's safe.
          </h2>
          <p className="reveal" style={{ fontSize: 15.5, color: "rgba(244,246,250,0.68)", lineHeight: 1.75, marginBottom: 24, maxWidth: 460, transitionDelay: "0.1s" }}>
            Prompts aren't guarantees. Every AI recommendation passes through a deterministic policy
            engine before anything executes. An automated eval suite re-checks the resulting audit
            trail after every run to prove the guardrails actually held, not just that they were
            designed to.
          </p>
          <Link
            to="/architecture"
            className="reveal"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              padding: "11px 20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(255,255,255,0.22)",
              transitionDelay: "0.15s",
            }}
          >
            See the full architecture <ArrowRight size={14} />
          </Link>
        </div>
        <GuardrailEvals />
      </div>
    </section>
  );
}

/* -------------------------------------------------------- WhyDifferent */
function WhyDifferent() {
  const points = [
    {
      title: "Real diagnosis, not a lookup table",
      body: "Most \"AI recovery\" demos hardcode if/else logic and call it AI. Every diagnosis here is a live LLM call, and its actual reasoning is what gets logged, not a template filled in after the fact.",
    },
    {
      title: "The model never holds the safety limits",
      body: "A separate deterministic policy engine enforces every hard rule (attempt caps, discount limits, no-repeat actions). A bad or manipulated generation can't talk its way past them.",
    },
    {
      title: "Every claim on this site is checkable",
      body: "Guardrail evals re-verify the real audit trail after every run. The numbers you see here come from that same trail, not a slide someone typed up.",
    },
    {
      title: "It fails honestly",
      body: "When an LLM call fails, the pipeline falls back to a rule engine and logs exactly why, instead of quietly pretending nothing went wrong.",
    },
  ];
  return (
    <section style={{ padding: "100px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="container">
        <div style={{ marginBottom: 48, maxWidth: 640 }}>
          <Eyebrow>Why this is different</Eyebrow>
          <WordReveal as="h2" style={{ fontSize: 34 }} parts={[{ text: "Not a rules bot wearing an AI costume." }]} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {points.map((p, i) => (
            <div key={p.title} className="reveal surface" style={{ padding: 24, transitionDelay: `${i * 0.05}s` }}>
              <h3 style={{ fontSize: 15.5, marginBottom: 8 }}>{p.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.65 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Scope */
function Scope() {
  const inScope = [
    "Root-cause diagnosis via a live LLM for failed and abandoned transactions",
    "A deterministic policy engine enforcing hard safety limits",
    "Simulated recovery execution with realistic, probabilistic outcomes",
    "A full audit trail plus automated guardrail evals on every run",
    "A live console, pipeline runner, and tool-calling assistant",
  ];
  const outOfScope = [
    "Real payment gateway or webhook integration (outcomes are simulated, not live retries)",
    "Production auth, multi-tenant accounts, or role-based access",
    "Actually sending customer messages over WhatsApp or SMS (the text is generated, not delivered)",
  ];
  return (
    <section style={{ padding: "100px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="container">
        <div style={{ marginBottom: 48, maxWidth: 640 }}>
          <Eyebrow>Scope</Eyebrow>
          <WordReveal as="h2" style={{ fontSize: 34 }} parts={[{ text: "What's in scope, and what's not." }]} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          <div className="reveal surface" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Layers size={16} />
              </div>
              <h3 style={{ fontSize: 15.5 }}>Built and working</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {inScope.map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <ShieldCheck size={15} color="var(--green)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal surface" style={{ padding: 28, transitionDelay: "0.08s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--slate-soft)", color: "var(--slate)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ban size={16} />
              </div>
              <h3 style={{ fontSize: 15.5 }}>Out of scope, on purpose</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {outOfScope.map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Ban size={15} color="var(--text-tertiary)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Capabilities */
function Capabilities() {
  const cards = [
    { title: "Console", desc: "Full transaction intelligence dashboard. Filter, search, and drill into any case's complete audit trail.", to: "/console" },
    { title: "Live pipeline", desc: "Trigger a real run and watch transactions move through diagnosis, policy, and simulation in real time.", to: "/pipeline" },
    { title: "AI Assistant", desc: "Ask questions in plain English. It calls real tools against your live case data and never invents an answer.", to: "/assistant" },
    { title: "Architecture", desc: "An interactive walkthrough of every stage in the pipeline, from ingestion to explanation.", to: "/architecture" },
  ];
  return (
    <section style={{ padding: "100px 0" }}>
      <div className="container">
        <div style={{ marginBottom: 48, maxWidth: 600 }}>
          <Eyebrow>Explore the platform</Eyebrow>
          <WordReveal as="h2" style={{ fontSize: 34 }} parts={[{ text: "Not just an API demo." }]} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {cards.map((c, i) => (
            <Link
              key={c.title}
              to={c.to}
              className="reveal surface tilt"
              style={{
                padding: 26,
                display: "block",
                transitionDelay: `${i * 0.05}s`,
              }}
              onMouseMove={(e) => { handleTilt(e); e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { resetTilt(e); e.currentTarget.style.borderColor = ""; }}
            >
              <h3 style={{ fontSize: 17, marginBottom: 10 }}>{c.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>{c.desc}</p>
              <span style={{ fontSize: 13, color: "var(--accent-strong)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                Explore <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- CTA */
function CTA() {
  return (
    <section style={{ padding: "80px 0 100px" }}>
      <div
        className="container reveal surface"
        style={{
          borderRadius: 28,
          padding: "72px 40px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <WordReveal
          as="h2"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 14, position: "relative" }}
          parts={[{ text: "See it diagnose, decide, and explain, live." }]}
        />
        <p style={{ color: "var(--text-secondary)", fontSize: 15, maxWidth: 480, margin: "0 auto 32px", position: "relative" }}>
          Every number on this site comes from an actual pipeline run against a synthetic dataset.
          Open the console and check for yourself.
        </p>
        <Link to="/console" className="btn btn-primary" style={{ position: "relative" }}>
          Open the Console <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <div className="reveal" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-strong)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
      {children}
    </div>
  );
}
