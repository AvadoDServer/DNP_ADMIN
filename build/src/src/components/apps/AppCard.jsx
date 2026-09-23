import React from "react";
import { Link } from "react-router-dom";
import AppAvatar from "components/ui/AppAvatar";
import { StatusDot } from "components/ui/StatusPill";
import { cn } from "components/ui/cn";
import { appStatus } from "components/appStatus";
import { appTitle } from "health/rules/apps";
import { useHealth } from "health/HealthProvider";

export function openUrl(pkg) {
  const w = pkg.manifest && pkg.manifest.ui && pkg.manifest.ui.OnboardingWizard;
  return w && w.external && w.url ? w.url : null;
}

// Only an urgent state gets coloured text (matches the status dot's tone);
// a healthy "Running" reads as quiet muted text, same as StatusPill.
const STATE_TEXT_TONE = {
  success: "text-fg-muted",
  warning: "text-warning-text",
  danger: "text-danger-text",
  accent: "text-accent",
  neutral: "text-fg-muted",
};

/**
 * AppCard — an app "bay" (per the Appliance mockups): a 44px icon tile, the
 * app's name in Sen, a one-line state and a status light in the corner, the
 * whole bay a single link. A critical finding for this app draws a red
 * inset ring around it. Apps with an external onboarding wizard open that
 * directly; everything else opens the package's own page.
 */
export default function AppCard({ pkg }) {
  const { findings, updates } = useHealth();
  const status = appStatus(pkg, { findings, updates });
  const external = openUrl(pkg);
  const page = `/packages/${pkg.name}`;
  const hasCriticalFinding = (findings || []).some(f => f.appId === pkg.name && f.severity === "critical");

  const bayClassName = cn(
    // Appliance tile: radius 18, no border in light (a bottom shelf shadow
    // stands in for it), a hairline border in dark.
    "group relative flex min-w-0 flex-col gap-3.5 rounded-tile bg-surface p-5 text-fg no-underline shadow-[0_1px_0_rgb(var(--border))] transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:shadow-focus dark:border dark:border-border dark:shadow-none dark:hover:border-accent/60",
    hasCriticalFinding && "ring-2 ring-inset ring-danger/40"
  );

  const bayContent = (
    <>
      <div className="flex items-center justify-between">
        <AppAvatar pkg={pkg} size={44} />
        <StatusDot tone={status.tone} />
      </div>
      <div className="min-w-0">
        <h3 className="mb-0 break-words font-display text-lg font-bold leading-snug text-fg">{appTitle(pkg)}</h3>
        <p className={cn("mb-0 mt-1 truncate text-sm font-medium", STATE_TEXT_TONE[status.tone] || STATE_TEXT_TONE.neutral)}>
          {status.label}
        </p>
      </div>
    </>
  );

  return external ? (
    <a href={external} target="_blank" rel="noopener noreferrer" className={bayClassName}>
      {bayContent}
    </a>
  ) : (
    <Link to={page} className={bayClassName}>
      {bayContent}
    </Link>
  );
}
