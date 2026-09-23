import React from "react";
import Button from "components/ui/Button";
import { useMode } from "settings/ModeProvider";

/**
 * Shown at the top of an Advanced-only page when it's reached from Simple
 * mode — a deep link, a Help topic step, a finding's fix link (spec §5:
 * "Simple never hides a problem; deep links to Advanced-only pages work in
 * Simple with an 'Advanced page' note"). The page underneath still renders
 * in full; this only explains why it isn't in the Simple sidebar and offers
 * the one-click way to keep it there.
 */
export default function AdvancedNote({ children }) {
  const { setMode } = useMode();
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-accent/25 bg-accent/[0.06] px-4 py-3 text-sm"
    >
      <span className="min-w-[14rem] flex-1 text-fg-muted">
        {children || "This is an advanced page. It won't show in Simple mode's sidebar, but this link always works."}
      </span>
      <Button variant="secondary" size="sm" onClick={() => setMode("advanced")} className="flex-shrink-0">
        Switch to advanced mode
      </Button>
    </div>
  );
}
