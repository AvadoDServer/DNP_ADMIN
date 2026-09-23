import React from "react";
import Button from "components/ui/Button";
import { useMode } from "settings/ModeProvider";

const DEFAULT_MESSAGE = "Advanced page. It's usually hidden in simple mode.";

/**
 * AdvancedNote — a small inline notice shown when a Simple-mode owner has
 * reached a page or tab that's normally Advanced-only (spec §5: "Deep links
 * to Advanced-only pages open them (with a small 'Advanced page' note), they
 * are never 404s"). Offers a one-click switch to Advanced mode so the owner
 * doesn't have to hunt for the sidebar footer toggle.
 *
 * Shared by every page that needs this note (the app page's deep-linked
 * Logs/Settings/Files tabs, System's Advanced-only pages, etc.) rather than
 * each one rolling its own copy.
 */
export default function AdvancedNote({ children }) {
  const { setMode } = useMode();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/25 bg-accent/5 px-4 py-2.5 text-sm">
      <span className="text-fg-muted">{children || DEFAULT_MESSAGE}</span>
      <Button variant="outline" size="sm" pill onClick={() => setMode("advanced")}>
        Switch to advanced mode
      </Button>
    </div>
  );
}
