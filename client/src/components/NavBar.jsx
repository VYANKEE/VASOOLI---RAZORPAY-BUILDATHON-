import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo.jsx";

const LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/console", label: "Console" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/assistant", label: "Assistant" },
  { to: "/architecture", label: "Architecture" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.86)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <NavLink to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={30} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
            Vasooli
          </span>
        </NavLink>

        <nav style={{ display: "flex", gap: 28 }} className="nav-desktop">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NavLink to="/console" className="btn btn-primary nav-desktop" style={{ fontSize: 13, padding: "9px 16px" }}>
            Open Console
          </NavLink>
          <button
            className="nav-mobile-toggle"
            onClick={() => setOpen((v) => !v)}
            style={{ display: "none", padding: 6 }}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)} className="nav-link">
              {l.label}
            </NavLink>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-toggle { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
