import React from "react";
import { Link } from "react-router-dom";
import AppAvatar from "components/ui/AppAvatar";
import StatusPill from "components/ui/StatusPill";
import { appStatus, appDescription } from "components/appStatus";
import { appTitle } from "health/rules/apps";
import { useHealth } from "health/HealthProvider";

export function openUrl(pkg) {
  const w = pkg.manifest && pkg.manifest.ui && pkg.manifest.ui.OnboardingWizard;
  return w && w.external && w.url ? w.url : null;
}

export default function AppCard({ pkg }) {
  const { findings, updates } = useHealth();
  const status = appStatus(pkg, { findings, updates });
  const external = openUrl(pkg);
  const page = `/packages/${pkg.name}`;
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <AppAvatar pkg={pkg} />
        <div className="min-w-0 flex-1">
          <h3 className="mb-0 break-words font-display text-base font-semibold leading-snug text-fg">{appTitle(pkg)}</h3>
          <p className="mb-0 mt-0.5 break-words text-sm text-fg-muted">{appDescription(pkg)}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={status} />
        <div className="flex gap-3 text-sm font-medium">
          {external ? (
            <a href={external} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Open</a>
          ) : (
            <Link to={`${page}?tab=setup`} className="text-accent hover:underline">Open</Link>
          )}
          <Link to={page} className="text-fg-muted hover:text-fg">Manage</Link>
        </div>
      </div>
    </article>
  );
}
