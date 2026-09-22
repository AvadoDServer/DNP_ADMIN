import React from "react";
import { Link } from "react-router-dom";
import { parsePercent } from "health/rules/storage";
import { cn } from "components/ui/cn";

const Meter = ({ label, pct, detail }) => {
  const tone = pct >= 90 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand";
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="tabular-nums text-fg-muted">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct || 0, 100)}%` }} />
      </div>
      {detail && <p className="mb-0 mt-1 truncate text-xs text-fg-subtle">{detail}</p>}
    </div>
  );
};

export default function ResourcesStrip({ stats = {} }) {
  return (
    <section aria-label="Resources" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:gap-6">
      <Meter label="CPU" pct={parsePercent(stats.cpu)} detail={stats.cpuName} />
      <Meter label="Memory" pct={parsePercent(stats.memory)} detail={stats.memUsed && `${stats.memUsed} of ${stats.memTotal}`} />
      <Meter label="Disk" pct={parsePercent(stats.disk)} detail={stats.diskUsed && `${stats.diskUsed} of ${stats.diskTotal}`} />
      <Link to="/system/storage" className="self-start text-sm font-medium text-accent hover:underline sm:self-center">Storage</Link>
    </section>
  );
}
