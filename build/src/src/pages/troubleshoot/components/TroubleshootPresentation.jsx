import React from "react";

/**
 * Presentational helpers local to the Support / Troubleshoot page. Composed
 * from the shared design-system tokens — no bespoke CSS. Mirrors the tone of
 * the already-migrated Dashboard / My DApps pages.
 */

/** Page hero header. */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-1 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{title}</h1>
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
