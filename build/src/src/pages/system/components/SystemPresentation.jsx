import React from "react";
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

/** Page hero header. */
export function PageHeader({ title, subtitle, eyebrow, children }) {
  return (
    <div className="mb-6 flex flex-col gap-1 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{title}</h1>
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            {eyebrow}
          </span>
        )}
        {children}
      </div>
      {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
    </div>
  );
}

/** Section header matching the Dashboard's tone. */
export function SectionHeader({ title, count, action }) {
  return (
    <div className="mb-4 mt-8 flex items-end justify-between gap-3 first:mt-0">
      <div className="flex items-center gap-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-fg-muted">
          {title}
        </h2>
        {typeof count === "number" && (
          <span className="rounded-full bg-fg/[0.06] px-2 py-0.5 text-xs font-semibold text-fg-subtle">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
