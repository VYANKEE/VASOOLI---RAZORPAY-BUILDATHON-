import React from "react";

// Vasooli's mark: a recovery arrow (things coming back) resolving
// into a checkmark (verified / audited), on a gradient badge. Replaces the
// plain letter-box "R" used everywhere the brand needs an icon.
export default function Logo({ size = 30 }) {
  const gradId = "ra-logo-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#305eff" />
          <stop offset="1" stopColor="#1e46d8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradId})`} />
      <path
        d="M10.2 18.4a5.8 5.8 0 1 1 1.9 4"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M10 13.6v4.6h4.6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M17.8 16.2l2 2 3.4-3.8" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
