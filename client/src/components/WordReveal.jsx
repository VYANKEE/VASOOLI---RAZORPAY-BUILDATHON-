import React from "react";

// One shared implementation of the "text reveals word-by-word as you
// scroll into it" effect used across the landing page. The wrapping tag
// carries the standard .reveal class (observed by useReveal — same
// mechanism as every other section), and each word is its own span with
// a staggered transition-delay driven by a --i custom property, so the
// whole heading reads as a cascade rather than one flat fade.
//
// parts: Array<{ text: string } | { text: string, gradient: true } | { break: true }>
export default function WordReveal({ parts, as: Tag = "h2", className = "", style }) {
  let i = 0;
  return (
    <Tag className={`reveal ${className}`} style={style}>
      {parts.map((part, pi) => {
        if (part.break) return <br key={`br-${pi}`} />;
        const words = part.text.split(" ").filter(Boolean);
        return words.map((w, wi) => {
          const idx = i++;
          return (
            <span key={`${pi}-${wi}`} className={`word${part.gradient ? " text-gradient" : ""}`} style={{ "--i": idx }}>
              {w}
              {" "}
            </span>
          );
        });
      })}
    </Tag>
  );
}
