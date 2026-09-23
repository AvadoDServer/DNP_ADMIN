import React from "react";
import { cn } from "./cn";

/**
 * The header every page starts with. One place for the title scale and the
 * spacing below it, so pages line up with each other.
 *
 * - eyebrow: where the page sits ("DappStore" above a package title)
 * - actions: buttons that act on the whole page, right-aligned
 * - children: small things next to the title (a status badge)
 */
export function PageHeader({ title, subtitle, eyebrow, actions, children, className }) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex flex-col gap-1">
        {eyebrow && (
          <span className="text-xs font-semibold tracking-wide text-fg-subtle">{eyebrow}</span>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mb-0 font-display text-4xl font-bold tracking-tight text-fg">{title}</h1>
          {children}
        </div>
        {subtitle && <p className="mb-0 max-w-2xl text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Heading of a section within a page, with an optional count and action. */
export function SectionHeader({ title, count, action, first = false, className }) {
  return (
    <div
      className={cn(
        "mb-3 flex items-end justify-between gap-3",
        first ? "mt-0" : "mt-8",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <h2 className="mb-0 text-sm font-semibold text-fg-muted">{title}</h2>
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

export default PageHeader;
