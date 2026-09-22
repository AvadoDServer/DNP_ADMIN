import React from "react";
import { cn } from "./cn";

export default function Tabs({ tabs, active, onChange, className }) {
  const onKeyDown = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    onChange(tabs[(i + d + tabs.length) % tabs.length].id);
  };
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:shadow-focus",
              selected ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {t.label}
            {t.badge ? <span className="rounded-full bg-warning/15 px-1.5 text-xs text-warning">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
