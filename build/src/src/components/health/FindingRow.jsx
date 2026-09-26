import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import Button from "components/ui/Button";
import { cn } from "components/ui/cn";
import { runFixAction } from "health/fixActions";
import { useHealth } from "health/HealthProvider";
import { useMode } from "settings/ModeProvider";

const ICON = {
  critical: { glyph: "M18 6 6 18M6 6l12 12", cls: "bg-danger/15 text-danger-text", label: "Action required" },
  warning: { glyph: "M12 8v5M12 16.5h.01", cls: "bg-warning/15 text-warning-text", label: "Needs attention" },
  info: { glyph: "M12 11v5M12 7.5h.01", cls: "bg-accent/15 text-accent", label: "Tip" },
};

const ACTION_TIMEOUT_MS = 15000;

export default function FindingRow({ finding, compact = false, hideTitle = false, showWhy = false }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const dispatch = useDispatch();
  const { dismiss } = useHealth();
  const { isAdvanced } = useMode();
  const icon = ICON[finding.severity] || ICON.info;
  const { fix } = finding;
  const hasSteps = Array.isArray(finding.steps) && finding.steps.length > 0;
  // Only https links: `learnMore` opens outside the Admin, in a new tab.
  const learnMore = typeof finding.learnMore === "string" && /^https:\/\//.test(finding.learnMore) ? finding.learnMore : null;
  // `detail` is mostly technical (slot numbers, error text), so Simple mode
  // shows it only when the rule marks it as plain enough (detailInSimple).
  const showDetail = !compact && Boolean(finding.detail) && (isAdvanced || finding.detailInSimple === true);

  useEffect(() => {
    if (!starting) return undefined;
    const timer = setTimeout(() => setStarting(false), ACTION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [starting]);

  const handleAction = () => {
    setStarting(true);
    runFixAction(finding, dispatch);
  };

  const fixButton =
    fix && fix.kind === "link" ? (
      <Button as={Link} to={fix.to} size="sm" variant={finding.severity === "info" ? "secondary" : "primary"}>
        {fix.label}
      </Button>
    ) : fix && fix.kind === "action" ? (
      <Button size="sm" onClick={handleAction} disabled={starting}>{starting ? "Starting…" : fix.label}</Button>
    ) : fix && fix.kind === "steps" ? (
      <Button size="sm" variant="secondary" onClick={() => setStepsOpen(o => !o)} aria-expanded={stepsOpen}>
        {fix.label}
      </Button>
    ) : null;

  // Written steps behind a link or action fix get their own toggle (the same
  // list and state). A "steps" fix already is that toggle: never a second one.
  const stepsToggle =
    hasSteps && !(fix && fix.kind === "steps") ? (
      <Button size="sm" variant="ghost" onClick={() => setStepsOpen(o => !o)} aria-expanded={stepsOpen}>
        How to fix it
      </Button>
    ) : null;

  // "Read more" belongs to the explanation: it shows with the why text (inline
  // when the why is always shown), so it adds no button to the row.
  const learnMoreLink = learnMore ? (
    <a href={learnMore} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
      Read more
    </a>
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
            {!hideTitle && <p className="mb-0 break-words font-medium text-fg">{finding.title}</p>}
            {!compact && finding.why && (
              showWhy ? (
                <p className="mt-0.5 text-sm text-fg-muted">
                  {finding.why}
                  {learnMoreLink && <> {learnMoreLink}</>}
                </p>
              ) : (
                <>
                  <button type="button" onClick={() => setWhyOpen(o => !o)} className="mt-0.5 text-left text-sm text-fg-muted hover:text-fg" aria-expanded={whyOpen}>
                    {whyOpen ? finding.why : "Why this matters"}
                  </button>
                  {whyOpen && learnMoreLink && <p className="mb-0 mt-0.5 text-sm">{learnMoreLink}</p>}
                </>
              )
            )}
            {!compact && !finding.why && learnMoreLink && <p className="mb-0 mt-0.5 text-sm">{learnMoreLink}</p>}
            {showDetail && (
              <p className="mt-0.5 break-words text-xs text-fg-subtle">{finding.detail}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {fixButton}
            {stepsToggle}
            {finding.secondary && (
              <Button as={Link} to={finding.secondary.to} size="sm" variant="ghost">{finding.secondary.label}</Button>
            )}
            {finding.dismissable && (
              <Button size="sm" variant="ghost" onClick={() => dismiss(finding.id)}>Hide</Button>
            )}
          </div>
        </div>
        {stepsOpen && hasSteps && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
            {finding.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
      </div>
    </li>
  );
}
