import React from "react";
import { parsePercent } from "health/rules/storage";
import { cn } from "components/ui/cn";

// Spec §6.0 ranges (design doc, 2026-09-23): each reading has its own
// warn/critical thresholds — a processor sustaining 85% is normal, but the
// same 85% on memory is already the warning band.
const RANGES = {
  processor: { warn: 80, crit: 95 },
  memory: { warn: 85, crit: 95 },
  disk: { warn: 80, crit: 90 },
};

const BAR_TONE = {
  ok: "bg-success",
  warn: "bg-warning",
  crit: "bg-danger",
};

function toneFor(kind, pct) {
  if (pct === null) return "ok";
  const { warn, crit } = RANGES[kind];
  if (pct >= crit) return "crit";
  if (pct >= warn) return "warn";
  return "ok";
}

/** One gauge row: label, thin bar, percentage — matches the mockups' box readings under the device drawing. */
function Gauge({ kind, label, pct }) {
  const tone = toneFor(kind, pct);
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_40px] items-center gap-3 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="block h-1.5 rounded-full bg-border">
        <span
          className={cn("block h-1.5 rounded-full", BAR_TONE[tone])}
          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
        />
      </span>
      {/* Missing values show "—", never 0 — a 0% reading and "not reported" must never look the same. */}
      <span className="text-right tabular-nums text-fg">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
    </div>
  );
}

/** Box readings (Home hero, under the AVADO device): processor, memory, disk space. */
export default function ResourcesStrip({ stats = {} }) {
  return (
    <div aria-label="Box readings" className="flex w-full max-w-[330px] flex-col gap-3">
      <Gauge kind="processor" label="Processor" pct={parsePercent(stats.cpu)} />
      <Gauge kind="memory" label="Memory" pct={parsePercent(stats.memory)} />
      <Gauge kind="disk" label="Disk" pct={parsePercent(stats.disk)} />
    </div>
  );
}
