import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import ProgressBar from "components/ui/ProgressBar";
import { PageHeader } from "components/ui/PageHeader";
import { cn } from "components/ui/cn";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { clientsByRole, ROLES, NETWORKS } from "health/clients";
import { stakingSteps } from "../steps";

const REQUIRED_IDS = ["execution", "consensus", "keys", "feeRecipient"];

function storageKeyFor(cc) {
  return cc ? `avado.stakingSetup.${cc.pkg.name}` : null;
}

function readManual(key) {
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeManual(key, manual) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(manual));
  } catch (e) {
    // Private mode or blocked storage: ticks last until reload.
  }
}

/**
 * Filled check (done) · empty circle with the step number (to do) · dashed
 * circle with the step number (optional). The `<ol>` around these rows is a
 * flex container (for the icon/content row layout), which suppresses the
 * browser's own list-item numbering — so the number is rendered explicitly
 * here, inside the marker itself, instead.
 */
function StateMarker({ state, number }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-fg-inverse">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span className="sr-only">Done</span>
      </span>
    );
  }
  const optional = state === "optional";
  return (
    <span
      className={cn(
        "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold text-fg-subtle",
        optional ? "border-dashed border-border-strong" : "border-border-strong"
      )}
    >
      {number}
    </span>
  );
}

function StepRow({ step, number, isFirst, ccInstalled, manual, onToggle }) {
  const needsConsensusFirst = !step.auto && !ccInstalled;
  return (
    <li className={cn("flex gap-3 py-4", !isFirst && "border-t border-border")}>
      <StateMarker state={step.state} number={number} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mb-0 break-words font-medium text-fg">{step.title}</p>
          {step.state === "optional" && <Badge variant="neutral">Optional</Badge>}
        </div>
        <p className="mb-0 mt-1 text-sm text-fg-muted">{step.why}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {needsConsensusFirst ? (
            <span className="text-sm text-fg-subtle">Install a consensus client first</span>
          ) : (
            step.action && (
              <Button as={Link} to={step.action.to} size="sm" variant={step.state === "done" ? "secondary" : "primary"}>
                {step.action.label}
              </Button>
            )
          )}
          {!step.auto && ccInstalled && (
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={Boolean(manual[step.id])}
                onChange={e => onToggle(step.id, e.target.checked)}
                className="h-4 w-4 rounded border-border-strong text-accent focus-visible:shadow-focus"
              />
              I've done this
            </label>
          )}
        </div>
      </div>
    </li>
  );
}

export default function StakingSetup() {
  const packages = useSelector(getDnpInstalled) || [];
  const cc = clientsByRole(packages, ROLES.CONSENSUS).filter(x => x.client.network === "mainnet")[0] || null;
  const storageKey = storageKeyFor(cc);
  const [manual, setManual] = useState(() => readManual(storageKey));

  // The tracked consensus client can change (installed, removed, swapped);
  // re-read its own ticks from storage whenever that happens.
  useEffect(() => {
    setManual(readManual(storageKey));
  }, [storageKey]);

  function toggle(id, checked) {
    setManual(prev => {
      const next = { ...prev, [id]: checked };
      writeManual(storageKey, next);
      return next;
    });
  }

  const steps = stakingSteps(packages, manual);
  const doneRequired = steps.filter(s => REQUIRED_IDS.includes(s.id) && s.state === "done").length;
  const allRequiredDone = doneRequired === REQUIRED_IDS.length;

  // A note on mainnet vs. testnet, shown only when clients for more than one
  // network are installed (spec §5.8) — this checklist itself only tracks mainnet.
  const clientEntries = [...clientsByRole(packages, ROLES.EXECUTION), ...clientsByRole(packages, ROLES.CONSENSUS)];
  const installedNetworks = [...new Set(clientEntries.map(x => x.client.network).filter(Boolean))];
  const otherNetworks = installedNetworks.filter(n => n !== "mainnet");
  const showNetworkNote = installedNetworks.length > 1 && otherNetworks.length > 0;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Staking setup" subtitle="Everything a validator on Ethereum mainnet needs, in order." />

      {showNetworkNote && (
        <p className="mb-4 text-sm text-fg-muted">
          You also have {otherNetworks.map(n => (NETWORKS[n] || {}).label || n).join(" and ")} clients installed.
          This checklist covers Ethereum mainnet; testnet clients don't earn real rewards.
        </p>
      )}

      <div className="mb-4">
        <div className="mb-1.5 text-sm text-fg-muted">
          {doneRequired} of {REQUIRED_IDS.length} required steps done
        </div>
        <ProgressBar
          value={(doneRequired / REQUIRED_IDS.length) * 100}
          size="sm"
          variant={allRequiredDone ? "success" : "accent"}
        />
      </div>

      <Card padding="lg">
        <ol className="flex list-none flex-col">
          {steps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              number={i + 1}
              isFirst={i === 0}
              ccInstalled={Boolean(cc)}
              manual={manual}
              onToggle={toggle}
            />
          ))}
        </ol>
      </Card>
    </div>
  );
}
