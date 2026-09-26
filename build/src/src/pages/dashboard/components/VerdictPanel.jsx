import React, { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "components/ui/cn";
import FindingRow from "components/health/FindingRow";
import Spinner from "components/ui/Spinner";
import { useHealth } from "health/HealthProvider";

// Status-word line + device-light tone, per verdict level. `ok` uses
// --success (the same token AvadoDevice's green light uses), so the dot
// here and the box's status light always agree.
const TONE = {
  critical: { dot: "bg-danger", ring: "ring-danger/30", text: "text-danger-text" },
  warning: { dot: "bg-warning", ring: "ring-warning/30", text: "text-warning-text" },
  ok: { dot: "bg-success", ring: "ring-success/30", text: "text-fg" },
};

export function verdictSentence(verdict, findings) {
  if (verdict.level === "ok") return "Your AVADO is healthy.";
  return findings[0] ? findings[0].title : verdict.label;
}

export function VerdictView({ verdict, findings, checkedAt, onRefresh, limit = 5, checksPassed, ready = true }) {
  const [all, setAll] = useState(false);

  // Until the installed-packages list has actually loaded, there is nothing
  // to have a verdict about yet — show a neutral "checking" state instead of
  // a false "all good" (no findings computed over empty/partial data). The
  // device drawing shows its grey ("checking") light for the same reason.
  if (!ready) {
    return (
      <div className="flex flex-col gap-2">
        <p className="mb-0 flex items-center gap-2 text-sm font-semibold text-fg-muted">
          <Spinner size="sm" />
          Checking
        </p>
        <h1 className="mb-0 break-words font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
          Checking your AVADO…
        </h1>
      </div>
    );
  }

  const tone = TONE[verdict.level] || TONE.ok;
  const healthy = verdict.level === "ok";
  // The headline (h1) is already the worst finding's title — showing that
  // same finding again as the first row would just repeat it. Instead its
  // `why`/fix/secondary render right under the headline, uncollapsed, and
  // the row list below covers only the rest.
  const headline = healthy ? null : findings[0];
  const rest = healthy ? findings : findings.slice(1);
  const shown = all ? rest : rest.slice(0, limit);
  const checkedAtButton = (
    <button type="button" onClick={onRefresh} className="font-medium hover:text-fg">
      Checked {checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Check again
    </button>
  );

  return (
    <div className="flex max-w-[700px] flex-col gap-3">
      <p className={cn("mb-0 flex items-center gap-2.5 text-sm font-semibold", tone.text)}>
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full ring-4", tone.dot, tone.ring, verdict.level !== "ok" && "motion-safe:animate-pulse-once")} />
        {verdict.label}
      </p>
      <h1 className="mb-0 break-words font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
        {verdictSentence(verdict, findings)}
      </h1>
      {headline && (
        <ul className="-mt-1 pl-0">
          {/* key={headline.id}: without it, a refresh that changes which
              finding is the headline reuses the same FindingRow instance —
              its internal "Starting…" (action-button) state would then
              wrongly carry over onto an unrelated finding. */}
          <FindingRow key={headline.id} finding={headline} hideTitle showWhy canHide />
        </ul>
      )}
      {shown.length > 0 && <ul className="divide-y divide-border/70 pl-0">{shown.map(f => <FindingRow key={f.id} finding={f} canHide />)}</ul>}
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <span>{checksPassed} other checks passed ·</span>
        {checkedAtButton}
        <span>·</span>
        <Link to="/help" className="font-medium text-accent hover:underline">See all</Link>
        {!healthy && rest.length > limit && (
          <>
            <span>·</span>
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => setAll(a => !a)}>
              {all ? "Show fewer" : `Show all ${rest.length}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerdictPanel() {
  // Home lists `findings`, without what the owner hid here with "Hide"; Help
  // and the app pages list `allFindings`, hidden ones too. No "Show hidden
  // tips" link: it would stay on Home for as long as a hidden tip keeps
  // firing, and would bring a hidden two-validator-apps warning back too.
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
