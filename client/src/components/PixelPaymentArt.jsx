import React from "react";

// A small self-contained pixel-art illustration (card + coin + chat bubble)
// for the assistant's empty state. Inline SVG, no external image request,
// so it always renders even offline mid-demo, and it matches the coin
// motif used on the landing page's hero.
export default function PixelPaymentArt({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" style={{ display: "block", margin: "0 auto" }}>
      <defs>
        <linearGradient id="cardGrad" x1="0" y1="0" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b82ff" />
          <stop offset="1" stopColor="#1e46d8" />
        </linearGradient>
        <linearGradient id="coinGrad2" x1="0" y1="0" x2="10" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd873" />
          <stop offset="1" stopColor="#f5a623" />
        </linearGradient>
      </defs>

      {/* card */}
      <rect x="2" y="10" width="22" height="15" rx="1" fill="url(#cardGrad)" />
      <rect x="2" y="13" width="22" height="3" fill="#0f2670" />
      <rect x="4" y="20" width="7" height="2" fill="rgba(255,255,255,0.85)" />

      {/* coin popping out top-right, echoes the hero's floating coins */}
      <g transform="translate(20,2)">
        <rect x="1" y="0" width="8" height="1" fill="#c97f0f" />
        <rect x="0" y="1" width="1" height="7" fill="#c97f0f" />
        <rect x="9" y="1" width="1" height="7" fill="#c97f0f" />
        <rect x="1" y="8" width="8" height="1" fill="#c97f0f" />
        <rect x="1" y="1" width="8" height="7" fill="url(#coinGrad2)" />
        <text x="5" y="7" textAnchor="middle" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontWeight="700" fontSize="6" fill="#8a5710">
          ₹
        </text>
      </g>

      {/* small chat bubble, bottom-left, representing the assistant */}
      <g transform="translate(0,22)">
        <rect x="0" y="0" width="9" height="7" rx="1" fill="#fff" stroke="var(--border-strong)" />
        <rect x="1" y="2" width="5" height="1" fill="var(--border-strong)" />
        <rect x="1" y="4" width="3" height="1" fill="var(--border-strong)" />
      </g>
    </svg>
  );
}
