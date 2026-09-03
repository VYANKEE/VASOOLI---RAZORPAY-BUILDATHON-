import React from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import Logo from "./Logo.jsx";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", marginTop: 80, position: "relative", zIndex: 1 }}>
      <div className="container surface" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none", padding: "56px 32px 32px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            gap: 40,
            marginBottom: 48,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Logo size={28} />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>Vasooli</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6, maxWidth: 320 }}>
              An AI revenue-recovery platform for failed payments and abandoned checkouts. Real diagnosis,
              bounded automated action, and a fully explainable audit trail.
            </p>
          </div>

          <FooterCol
            title="Platform"
            links={[
              { to: "/console", label: "Console" },
              { to: "/pipeline", label: "Pipeline" },
              { to: "/assistant", label: "Assistant" },
            ]}
          />
          <FooterCol
            title="Learn"
            links={[
              { to: "/architecture", label: "Architecture" },
              { to: "/#how-it-works", label: "How it works" },
            ]}
          />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Project
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link to="/console" style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Guardrail evals</Link>
              <a
                href="/api/export/cases.csv"
                download
                style={{ fontSize: 13.5, color: "var(--accent-strong)", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={13} /> Download dataset (CSV)
              </a>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
            Built for the Razorpay Buildathon · Track 03: AI Revenue Recovery
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
            Built by <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Vyankatesh Kulkarni</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <Link key={l.to} to={l.to} style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
