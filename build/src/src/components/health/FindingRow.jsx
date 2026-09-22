import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import Button from "components/ui/Button";
import { cn } from "components/ui/cn";
import { runFixAction } from "health/fixActions";
import { useHealth } from "health/HealthProvider";

const ICON = {
  critical: { glyph: "M18 6 6 18M6 6l12 12", cls: "bg-danger/15 text-danger", label: "Action required" },
  warning: { glyph: "M12 8v5M12 16.5h.01", cls: "bg-warning/15 text-warning", label: "Needs attention" },
  info: { glyph: "M12 11v5M12 7.5h.01", cls: "bg-accent/15 text-accent", label: "Tip" },
};

export default function FindingRow({ finding, compact = false }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const dispatch = useDispatch();
  const { dismiss } = useHealth();
  const icon = ICON[finding.severity] || ICON.info;
  const { fix } = finding;

  const fixButton =
    fix && fix.kind === "link" ? (
      <Button as={Link} to={fix.to} size="sm" variant={finding.severity === "info" ? "secondary" : "primary"}>
        {fix.label}
      </Button>
    ) : fix && fix.kind === "action" ? (
      <Button size="sm" onClick={() => runFixAction(finding, dispatch)}>{fix.label}</Button>
    ) : fix && fix.kind === "steps" ? (
      <Button size="sm" variant="secondary" onClick={() => setStepsOpen(o => !o)} aria-expanded={stepsOpen}>
        {fix.label}
      </Button>
    ) : null;

  return (
    <li className="flex gap-3 py-3.5">
      <span className={cn("mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full", icon.cls)}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d={icon.glyph} />
        </svg>
        <span className="sr-only">{icon.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-0 break-words font-medium text-fg">{finding.title}</p>
            {!compact && finding.why && (
              <button type="button" onClick={() => setWhyOpen(o => !o)} className="mt-0.5 text-left text-sm text-fg-muted hover:text-fg" aria-expanded={whyOpen}>
                {whyOpen ? finding.why : "Why this matters"}
              </button>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {fixButton}
            {finding.secondary && (
              <Button as={Link} to={finding.secondary.to} size="sm" variant="ghost">{finding.secondary.label}</Button>
            )}
            {finding.dismissable && (
              <Button size="sm" variant="ghost" onClick={() => dismiss(finding.id)}>Hide</Button>
            )}
          </div>
        </div>
        {stepsOpen && finding.steps && finding.steps.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
            {finding.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
      </div>
    </li>
  );
}
