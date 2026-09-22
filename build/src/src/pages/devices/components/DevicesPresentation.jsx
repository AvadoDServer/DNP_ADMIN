import React from "react";
export { PageHeader, SectionHeader } from "components/ui/PageHeader";
import Card from "components/ui/Card";

/**
 * Presentational helpers local to the Connect (VPN) / Devices pages. Composed
 * from the shared design-system tokens — no bespoke CSS. Mirrors the tone of
 * the already-migrated Dashboard / My DApps pages.
 */



/** Generic empty state. */
export function EmptyState({ icon, title, children, action }) {
  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          {icon || (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          )}
        </span>
        <div>
          <div className="font-semibold text-fg">{title}</div>
          {children && <p className="mt-1 text-sm text-fg-muted">{children}</p>}
        </div>
        {action}
      </div>
    </Card>
  );
}

/** Shared icon-button chrome used by row actions. */
export const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-accent focus:outline-none focus-visible:shadow-focus";
