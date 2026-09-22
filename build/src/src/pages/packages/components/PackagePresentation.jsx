import React from "react";
export { PageHeader, SectionHeader } from "components/ui/PageHeader";
import Card from "components/ui/Card";
import Spinner from "components/ui/Spinner";
import Skeleton from "components/ui/Skeleton";

/**
 * Presentational helpers local to the My DApps pages. Composed entirely from
 * the shared design-system primitives — no bespoke CSS.
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

/** Generic empty / error state. */
export function EmptyState({ icon, title, children, action, tone = "accent" }) {
  const ring =
    tone === "danger"
      ? "bg-danger/10 text-danger"
      : "bg-accent/10 text-accent";
  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-6">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${ring}`}>
          {icon || (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
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

/** List skeleton while installed packages load. */
export function ListSkeleton({ rows = 4 }) {
  return (
    <Card padding="none" aria-busy="true" aria-label="Loading installed packages">
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-5 w-16" rounded="full" />
            <Skeleton className="h-4 w-48 flex-1" />
            <Skeleton className="h-8 w-8" rounded="md" />
            <Skeleton className="h-8 w-8" rounded="md" />
            <Skeleton className="h-5 w-10" rounded="full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
