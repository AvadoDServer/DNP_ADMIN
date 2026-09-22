import React from "react";
import Card from "components/ui/Card";
import Skeleton from "components/ui/Skeleton";

/**
 * Small presentational helpers local to the DappStore. Composed entirely from
 * the shared design-system primitives — no bespoke CSS.
 */

export function CategoryHeader({ title, count }) {
  return (
    <div className="mb-4 mt-8 flex items-end justify-between gap-3 first:mt-0">
      <div className="flex items-center gap-2.5">
        <h2 className="text-sm font-bold text-fg-muted">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-fg/[0.06] px-2 py-0.5 text-xs font-semibold text-fg-subtle">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

/** Shimmer grid shown while the store manifest is loading. */
export function StoreSkeleton({ count = 8 }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading DappStore"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} padding="md" className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 flex-shrink-0" rounded="lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="mt-1 h-8 w-full" rounded="full" />
        </Card>
      ))}
    </div>
  );
}

/** Generic empty/info state for the store. */
export function StoreEmpty({ icon, title, children, action }) {
  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          {icon || (
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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
