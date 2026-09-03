import React from "react";
import { ShieldCheck } from "lucide-react";

const ITEMS = [
  "Real-time failure diagnosis",
  "Policy-enforced guardrails",
  "Bounded automated recovery",
  "Fully explainable audit trail",
  "Live LLM reasoning",
  "Zero fabricated metrics",
  "11/11 guardrail checks passed",
];

// Continuous horizontal ticker — the content is duplicated once so the
// looped 50% translateX lines up seamlessly with no visible seam/jump.
export default function Marquee() {
  const content = [...ITEMS, ...ITEMS];
  return (
    <div className="marquee glass" aria-hidden="true">
      <div className="marquee-track">
        {content.map((t, i) => (
          <span className="marquee-item" key={i}>
            <ShieldCheck size={14} className="marquee-icon" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
