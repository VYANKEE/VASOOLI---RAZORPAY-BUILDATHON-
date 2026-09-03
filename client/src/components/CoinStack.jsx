import React from "react";

// A handful of pixel-art rupee coins, gently floating around the hero.
// Purely decorative (aria-hidden, pointer-events: none) and self-contained
// as inline SVG, so there is no external image dependency to fail during a
// live demo. The blocky/stepped outline is what gives it the "pixel art"
// character rather than a smooth circle.
function PixelCoin({ size = 46, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" style={style}>
      <defs>
        <linearGradient id="coinGrad" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd873" />
          <stop offset="1" stopColor="#f5a623" />
        </linearGradient>
      </defs>
      {/* stepped/pixelated circle outline */}
      <rect x="5" y="1" width="6" height="1" fill="#c97f0f" />
      <rect x="3" y="2" width="2" height="1" fill="#c97f0f" />
      <rect x="11" y="2" width="2" height="1" fill="#c97f0f" />
      <rect x="2" y="3" width="1" height="2" fill="#c97f0f" />
      <rect x="13" y="3" width="1" height="2" fill="#c97f0f" />
      <rect x="1" y="5" width="1" height="6" fill="#c97f0f" />
      <rect x="14" y="5" width="1" height="6" fill="#c97f0f" />
      <rect x="2" y="11" width="1" height="2" fill="#c97f0f" />
      <rect x="13" y="11" width="1" height="2" fill="#c97f0f" />
      <rect x="3" y="13" width="2" height="1" fill="#c97f0f" />
      <rect x="11" y="13" width="2" height="1" fill="#c97f0f" />
      <rect x="5" y="14" width="6" height="1" fill="#c97f0f" />
      {/* fill */}
      <rect x="3" y="3" width="10" height="10" fill="url(#coinGrad)" />
      <rect x="4" y="2" width="8" height="1" fill="url(#coinGrad)" />
      <rect x="4" y="13" width="8" height="1" fill="url(#coinGrad)" />
      <rect x="2" y="4" width="1" height="8" fill="url(#coinGrad)" />
      <rect x="13" y="4" width="1" height="8" fill="url(#coinGrad)" />
      {/* rupee glyph: real text keeps it legible at this size, the
          pixelated coin body around it still carries the pixel-art feel */}
      <text
        x="8"
        y="11.2"
        textAnchor="middle"
        fontFamily="'IBM Plex Mono', ui-monospace, monospace"
        fontWeight="700"
        fontSize="8"
        fill="#8a5710"
      >
        ₹
      </text>
    </svg>
  );
}

const COINS = [
  { size: 40, top: "12%", left: "6%", delay: "0s", duration: "6.5s", rotate: "-8deg" },
  { size: 30, top: "68%", left: "3%", delay: "1.1s", duration: "5.5s", rotate: "10deg" },
  { size: 34, top: "18%", right: "5%", delay: "0.6s", duration: "7s", rotate: "12deg" },
  { size: 46, top: "60%", right: "8%", delay: "1.6s", duration: "6s", rotate: "-6deg" },
];

export default function CoinStack() {
  return (
    <div className="coin-stack" aria-hidden="true">
      {COINS.map((c, i) => (
        <PixelCoin
          key={i}
          size={c.size}
          style={{
            position: "absolute",
            top: c.top,
            left: c.left,
            right: c.right,
            "--rot": c.rotate,
            animation: `coinFloat ${c.duration} ease-in-out ${c.delay} infinite`,
            filter: "drop-shadow(0 8px 16px rgba(245,166,35,0.35))",
          }}
        />
      ))}
      <style>{`
        .coin-stack {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        @keyframes coinFloat {
          0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
          50% { transform: translateY(-16px) rotate(calc(var(--rot, 0deg) * -1)); }
        }
        @media (max-width: 900px) {
          .coin-stack { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .coin-stack span, .coin-stack svg { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
