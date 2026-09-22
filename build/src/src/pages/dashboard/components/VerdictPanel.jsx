import React, { useState } from "react";
import { cn } from "components/ui/cn";
import FindingRow from "components/health/FindingRow";
import { useHealth } from "health/HealthProvider";

const BAND = {
  critical: { bg: "bg-verdict-crit", dot: "bg-danger", ring: "ring-danger/30" },
  warning: { bg: "bg-verdict-warn", dot: "bg-warning", ring: "ring-warning/30" },
  ok: { bg: "bg-verdict-ok", dot: "bg-brand", ring: "ring-brand/30" },
};

export function verdictSentence(verdict, findings) {
  if (verdict.level === "ok") return "All good. Your AVADO is healthy.";
  return findings[0] ? findings[0].title : verdict.label;
}

export function VerdictView({ verdict, findings, checkedAt, onRefresh, limit = 5 }) {
  const [all, setAll] = useState(false);
  const band = BAND[verdict.level] || BAND.ok;
  const shown = all ? findings : findings.slice(0, limit);
  return (
    <section aria-labelledby="verdict-title" className={cn("rounded-lg border border-border p-5 sm:p-6", band.bg)}>
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full ring-4", band.dot, band.ring, verdict.level !== "ok" && "motion-safe:animate-pulse-once")} />
        {verdict.label}
      </p>
      <h2 id="verdict-title" className="mb-0 break-words font-display text-2xl font-bold leading-tight text-fg sm:text-[2.5rem]">
        {verdictSentence(verdict, findings)}
      </h2>
      {shown.length > 0 && <ul className="mt-4 divide-y divide-border/70 pl-0">{shown.map(f => <FindingRow key={f.id} finding={f} />)}</ul>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
        {findings.length > limit ? (
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => setAll(a => !a)}>
            {all ? "Show fewer" : `Show all ${findings.length}`}
          </button>
        ) : <span />}
        <button type="button" onClick={onRefresh} className="hover:text-fg">
          Checked {checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Check again
        </button>
      </div>
    </section>
  );
}

export default function VerdictPanel() {
  const { verdict, findings, checkedAt, refresh } = useHealth();
  return <VerdictView verdict={verdict} findings={findings} checkedAt={checkedAt} onRefresh={refresh} />;
}
