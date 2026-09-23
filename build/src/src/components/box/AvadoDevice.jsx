import React, { useId } from "react";

/**
 * AvadoDevice — the "Appliance" hero illustration (Home): the owner's AVADO
 * box, with a status light in the verdict colour. Per the approved mockups
 * (mockups/home-*.dc.html), the casing itself renders the same in both
 * themes — only the light (glow + ring) changes — so the casing colours
 * live as theme-invariant tokens in theme.css (--device-*), while the light
 * uses the existing status tokens so it tracks the theme automatically.
 *
 * `light`: "ok" | "warning" | "critical" | "checking" (grey, health not
 * ready yet). Anything else falls back to "checking".
 */
const STATUS = {
  ok: { token: "--success", word: "green" },
  warning: { token: "--warning", word: "amber" },
  critical: { token: "--danger", word: "red" },
  checking: { token: "--fg-subtle", word: "grey" },
};

export default function AvadoDevice({ light, className }) {
  const status = STATUS[light] || STATUS.checking;
  const color = `rgb(var(${status.token}))`;
  const rawId = useId();
  const glowId = `avado-device-glow-${rawId}`;
  const bodyId = `avado-device-body-${rawId}`;

  return (
    <svg
      width="330"
      height="230"
      viewBox="0 0 360 250"
      role="img"
      aria-label={`Your AVADO box, status light ${status.word}`}
      className={className}
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--device-body-start))" />
          <stop offset="100%" stopColor="rgb(var(--device-body-end))" />
        </linearGradient>
      </defs>
      {/* Ground shadow */}
      <ellipse cx="180" cy="236" rx="150" ry="10" fill="rgb(var(--fg))" opacity="0.12" />
      {/* Casing */}
      <rect x="30" y="40" width="300" height="186" rx="26" fill={`url(#${bodyId})`} />
      <rect x="30" y="40" width="300" height="14" rx="7" fill="rgb(var(--device-vent))" />
      <text
        x="58"
        y="206"
        fontFamily="Sen, sans-serif"
        fontWeight="800"
        fontSize="20"
        letterSpacing="2"
        fill="rgb(var(--device-label))"
      >
        AVADO
      </text>
      {/* Status light: glow pulses once on mount (respects reduced motion via
          motion-safe:). `key={light}` forces a remount whenever the resolved
          colour changes, so the pulse plays again for the new colour instead
          of only ever playing once for the initial "checking" grey. */}
      <circle
        key={light}
        cx="252"
        cy="134"
        r="70"
        fill={`url(#${glowId})`}
        className="motion-safe:animate-pulse-once"
      />
      <circle cx="252" cy="134" r="30" fill="none" stroke={color} strokeWidth="6" />
      <circle cx="252" cy="134" r="16" fill="rgb(var(--device-center))" />
    </svg>
  );
}
