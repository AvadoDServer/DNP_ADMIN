import React from "react";
export { PageHeader, SectionHeader } from "components/ui/PageHeader";
import Spinner from "components/ui/Spinner";

/**
 * Presentational helpers local to the System pages. Composed entirely from the
 * shared design-system tokens — no bespoke CSS. Mirrors the tone of the
 * already-migrated Dashboard / My DApps pages.
 */

/** Centered loading state. */
export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-fg-muted">
      <Spinner size="lg" className="text-accent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Inline informational / warning callout. */
export function Callout({ tone = "warning", children }) {
  const tones = {
    warning: "border-warning/30 bg-warning/[0.08] text-fg",
    danger: "border-danger/30 bg-danger/[0.08] text-fg",
    accent: "border-accent/30 bg-accent/[0.08] text-fg",
  };
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${tones[tone] || tones.warning}`}
      role="alert"
    >
      {children}
    </div>
  );
}


