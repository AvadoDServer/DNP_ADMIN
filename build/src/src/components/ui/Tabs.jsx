import React, { useRef } from "react";
import { cn } from "./cn";

export default function Tabs({ tabs, active, onChange, className }) {
  const tabRefs = useRef([]);

  const focusAndChange = i => {
    const next = tabs[i];
    if (!next) return;
    onChange(next.id);
    const node = tabRefs.current[i];
    if (node) node.focus();
  };

  const onKeyDown = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (d) {
      e.preventDefault();
      focusAndChange((i + d + tabs.length) % tabs.length);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusAndChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndChange(tabs.length - 1);
    }
  };

  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1 overflow-x-auto", className)}>
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={node => (tabRefs.current[i] = node)}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:shadow-focus",
              selected ? "bg-accent/10 text-fg" : "text-fg-muted hover:bg-fg/[0.05] hover:text-fg"
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
