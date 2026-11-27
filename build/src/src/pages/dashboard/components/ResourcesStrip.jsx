import React from "react";
import { parsePercent } from "health/rules/storage";
import { cn } from "components/ui/cn";
import { formatCelsius, HOT_HINT } from "../temperatures";

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

const ROW = "grid grid-cols-[80px_minmax(0,1fr)_48px] items-center gap-3 text-sm";

function toneFor(kind, pct) {
  if (pct === null) return "ok";
  const { warn, crit } = RANGES[kind];
  if (pct >= crit) return "crit";
  if (pct >= warn) return "warn";
  return "ok";
}

/** Label, thin bar (0-100), value. */
function Bar({ label, width, tone, value }) {
  return (
    <div className={ROW}>
      <span className="text-fg-muted">{label}</span>
      <span className="block h-1.5 rounded-full bg-border">
        <span className={cn("block h-1.5 rounded-full", BAR_TONE[tone])} style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }} />
      </span>
      <span className="text-right tabular-nums text-fg">{value}</span>
    </div>
  );
}

/** One gauge row: label, thin bar, percentage — matches the mockups' box readings under the device drawing. */
function Gauge({ kind, label, pct }) {
  // Missing values show "—", never 0 — a 0% reading and "not reported" must never look the same.
  return <Bar label={label} width={pct ?? 0} tone={toneFor(kind, pct)} value={pct === null ? "—" : `${Math.round(pct)}%`} />;
}

/**
 * Temperatures (pickTemperatures rows), on a 0-100 °C bar. Nothing at all
 * when there are none (an older DAPPMANAGER, or a box without sensors).
 */
function Temperatures({ rows }) {
  if (!rows || !rows.length) return null;
  const hot = rows.some(r => r.tone !== "ok");
  return (
    <div role="group" aria-label="Temperature" className="flex flex-col gap-3 border-t border-border pt-3">
      <span className="text-xs font-semibold text-fg-muted">Temperature</span>
      {rows.map(r => (
        <Bar key={r.id} label={r.label} width={r.celsius} tone={r.tone} value={formatCelsius(r.celsius)} />
      ))}
      {hot && <p className="text-xs text-warning-text">{HOT_HINT}</p>}
    </div>
  );
}

/** Box readings (Home hero, next to the health verdict): processor, memory, disk space, and temperatures when known. */
export default function ResourcesStrip({ stats = {}, temperatures = null }) {
  return (
    <section aria-label="Box readings" className="flex w-full flex-col gap-3">
      <Gauge kind="processor" label="Processor" pct={parsePercent(stats.cpu)} />
      <Gauge kind="memory" label="Memory" pct={parsePercent(stats.memory)} />
      <Gauge kind="disk" label="Disk" pct={parsePercent(stats.disk)} />
      <Temperatures rows={temperatures} />
    </section>
  );
}
