import React, { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "components/ui/cn";
import FindingRow from "components/health/FindingRow";
import Spinner from "components/ui/Spinner";
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

export function VerdictView({ verdict, findings, checkedAt, onRefresh, limit = 5, checksPassed, ready = true }) {
  const [all, setAll] = useState(false);

  // Until the installed-packages list has actually loaded, there is nothing
  // to have a verdict about yet — show a neutral "checking" state instead of
  // a false "all good" (no findings computed over empty/partial data).
  if (!ready) {
    return (
      <section aria-labelledby="verdict-title" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg-muted">
          <Spinner size="sm" />
          Checking
        </p>
        <h2 id="verdict-title" className="mb-0 break-words font-display text-2xl font-bold leading-tight text-fg sm:text-[2.5rem]">
          Checking your AVADO…
        </h2>
      </section>
    );
  }

  const band = BAND[verdict.level] || BAND.ok;
  const healthy = verdict.level === "ok";
  // The headline (h2) is already the worst finding's title — showing that
  // same finding again as the first row would just repeat it. Instead its
  // `why`/fix/secondary render right under the headline, uncollapsed, and
  // the row list below covers only the rest.
  const headline = healthy ? null : findings[0];
  const rest = healthy ? findings : findings.slice(1);
  const shown = all ? rest : rest.slice(0, limit);
  const checkedAtButton = (
    <button type="button" onClick={onRefresh} className="hover:text-fg">
      Checked {checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Check again
    </button>
  );
  return (
    <section aria-labelledby="verdict-title" className={cn("rounded-lg border border-border p-5 sm:p-6", band.bg)}>
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full ring-4", band.dot, band.ring, verdict.level !== "ok" && "motion-safe:animate-pulse-once")} />
        {verdict.label}
      </p>
      <h2 id="verdict-title" className="mb-0 break-words font-display text-2xl font-bold leading-tight text-fg sm:text-[2.5rem]">
        {verdictSentence(verdict, findings)}
      </h2>
      {headline && (
        <ul className="mt-2 pl-0">
          <FindingRow finding={headline} hideTitle showWhy />
        </ul>
      )}
      {shown.length > 0 && <ul className="mt-4 divide-y divide-border/70 pl-0">{shown.map(f => <FindingRow key={f.id} finding={f} />)}</ul>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
        {healthy ? (
          <span className="flex flex-wrap items-center gap-1">
            <span>{checksPassed} checks passed ·</span>
            {checkedAtButton}
            <span>·</span>
            <Link to="/help" className="font-medium text-accent hover:underline">See all</Link>
          </span>
        ) : (
          <>
            {rest.length > limit ? (
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => setAll(a => !a)}>
                {all ? "Show fewer" : `Show all ${rest.length}`}
              </button>
            ) : <span />}
            {checkedAtButton}
          </>
        )}
      </div>
    </section>
  );
}

export default function VerdictPanel() {
  const { verdict, findings, checkedAt, refresh, checksPassed, ready } = useHealth();
  return (
    <VerdictView
      verdict={verdict}
      findings={findings}
      checkedAt={checkedAt}
      onRefresh={refresh}
      checksPassed={checksPassed}
      ready={ready}
    />
  );
}
