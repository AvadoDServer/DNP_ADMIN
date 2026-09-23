import React, { useState } from "react";
import { cn } from "components/ui/cn";
import { StatusDot } from "components/ui/StatusPill";
import { clientsByRole, NETWORKS, ROLES } from "health/clients";
import { epochProgress } from "health/chainProgress";
import { useHealth } from "health/HealthProvider";
import { useMode } from "settings/ModeProvider";

// chainData entries (services/chainData) are keyed by DAPPMANAGER's
// shortNameCapitalized(dnpName), e.g. "Nimbus", "Nimbus-holesky" — match the
// exact short name, case-insensitively (a substring match would wrongly let
// "nimbus" match "nimbus-holesky" on a different network).
function findChainEntry(chainData, pkgName) {
  const short = String(pkgName).split(".")[0].toLowerCase();
  return (chainData || []).find(c => c && String(c.name).toLowerCase() === short) || null;
}

function findSample(samples, client) {
  return (samples || []).find(s => s.client === client.promClient && s.network === client.network) || null;
}

// One of: "unknown" (no chain data yet), "error" (DAPPMANAGER couldn't reach
// the client to ask — `{ error: true, message }`, no `syncing` field, so it
// must never fall through to "synced"), "syncing" (chainData says so),
// "behind" (chainData says synced, but Prometheus shows it has drifted more
// than 2 slots behind wall-clock), "synced" (in step, with or without
// metrics to confirm it).
function chainState({ chainEntry, progress }) {
  if (!chainEntry) return "unknown";
  if (chainEntry.error) return "error";
  if (chainEntry.syncing) return "syncing";
  if (progress && progress.behind > 2) return "behind";
  return "synced";
}

const DOT_TONE = { unknown: "neutral", error: "warning", syncing: "warning", behind: "warning", synced: "success" };

function simpleSentence(clientLabel, state, progress) {
  if (state === "unknown") return "Waiting for chain data.";
  if (state === "error") return `${clientLabel} can't be reached.`;
  if (state === "syncing") return `${clientLabel} is syncing with the network.`;
  if (state === "behind") return `${clientLabel} is ${progress.behind} slots behind.`;
  return progress ? `${clientLabel} is in step with the network.` : `${clientLabel} is synced.`;
}

// Controller ruling (2026-09-23): behind 0-2 reads the same as in step —
// only a >2-slot gap is worth calling out, and "ahead" (a client whose head
// is past this tab's wall-clock estimate — clock drift, a stale `now`) never
// shows a negative "behind" number.
function behindLabel(progress) {
  if (progress.ahead > 0 || progress.behind <= 2) return "In step with the network";
  return `${progress.behind} slots behind`;
}

const CELL_TONE = {
  seen: "bg-success",
  missing: "bg-success/40",
  now: "bg-accent",
  future: "bg-border",
};

function EpochStrip({ progress, networkLabel, clientLabel, peers }) {
  const seenCount = progress.cells.filter(c => c === "seen").length;
  const missingCount = progress.cells.filter(c => c === "missing").length;
  return (
    // Three columns only from xl: below that the strip gets the panel's full
    // width, so cells never shrink to a couple of pixels (e.g. 640-1200 px
    // with the sidebar docked). On phones the epoch wraps into two rows so
    // each cell keeps a usable width down to 320 px.
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_150px] xl:items-center xl:gap-7">
      <div className="flex flex-col gap-1">
        <span className="text-[0.8125rem] text-fg-muted">{`${networkLabel}, via ${clientLabel}`}</span>
        <span className="font-display text-xl font-bold text-fg">{`Epoch ${progress.epoch}`}</span>
      </div>
      <div
        data-testid="epoch-cells"
        className="grid grid-cols-[repeat(var(--epoch-cols-narrow),minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(var(--epoch-cols),minmax(0,1fr))]"
        style={{
          "--epoch-cols": progress.cells.length,
          "--epoch-cols-narrow": Math.ceil(progress.cells.length / 2),
        }}
        aria-label={`Slots in this epoch: ${seenCount} seen, ${missingCount} not seen yet, now at slot ${progress.slotInEpoch}`}
      >
        {progress.cells.map((cell, i) => (
          <span key={i} aria-hidden="true" className={cn("h-[26px] rounded-[5px]", CELL_TONE[cell])} />
        ))}
      </div>
      <div className="flex flex-col gap-1 xl:text-right">
        <span className="font-display text-lg font-bold text-fg">{behindLabel(progress)}</span>
        {peers && <span className="text-[0.8125rem] text-fg-muted">{`${peers.value} peer${peers.value === 1 ? "" : "s"}`}</span>}
      </div>
    </div>
  );
}

/**
 * ChainStatus — Home's chain line (replaces ChainLine on Home).
 *
 * Simple: one line — status light, "Following <network>", a plain sentence,
 * and a "Show details" link that expands the strip inline for this visit
 * only (component state — it does not switch the global Simple/Advanced
 * mode).
 * Advanced (global mode, or expanded via "Show details"): the epoch strip,
 * "N slots behind"/"In step with the network", and peers — or, when
 * Prometheus metrics aren't available, the simple line plus a note to
 * install monitoring.
 *
 * Hidden entirely when no consensus client is installed.
 */
export default function ChainStatus() {
  const { packages, chainData, metrics, metricsFetchedAt, checkedAt } = useHealth();
  const { isAdvanced } = useMode();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const primary = clientsByRole(packages, ROLES.CONSENSUS)[0] || null;
  if (!primary) return null;

  const { pkg, client } = primary;
  const networkLabel = (NETWORKS[client.network] && NETWORKS[client.network].label) || client.network;
  const chainEntry = findChainEntry(chainData, pkg.name);
  const headSample = metrics && findSample(metrics.headSlot, client);
  // Measure the head sample against the wall clock at the moment it was
  // fetched: `checkedAt` moves every 5 s (stats poll) while the sample is
  // refreshed only every 60 s, so using it would call a synced client
  // "behind" for most of every minute.
  const sampleAt = (metricsFetchedAt || checkedAt).getTime();
  const progress = headSample
    ? epochProgress({ network: client.network, headSlot: headSample.value, now: sampleAt })
    : null;
  const peersSample = metrics && findSample(metrics.peers, client);

  const state = chainState({ chainEntry, progress });
  const sentence = simpleSentence(client.label, state, progress);
  const metricsUnavailable = metrics == null;
  const expanded = isAdvanced || detailsOpen;

  const simpleLine = (
    <div className="flex min-w-0 flex-wrap items-center gap-3.5">
      <StatusDot tone={DOT_TONE[state]} />
      <span className="font-semibold text-fg">{`Following ${networkLabel}`}</span>
      <span className="text-fg-muted">{sentence}</span>
    </div>
  );

  return (
    <section
      aria-label="Chain status"
      className="flex flex-col gap-4 rounded-xl bg-surface px-6 py-[18px] shadow-[0_1px_0_rgb(var(--border))] dark:border dark:border-border dark:shadow-none"
    >
      {!expanded ? (
        <div className="flex flex-wrap items-center gap-3.5">
          {simpleLine}
          <button
            type="button"
            className="ml-auto flex-shrink-0 font-semibold text-accent hover:underline"
            aria-expanded={false}
            onClick={() => setDetailsOpen(true)}
          >
            Show details
          </button>
        </div>
      ) : (
        <>
          {state === "error" ? (
            <div className="flex flex-col gap-2">
              {simpleLine}
              {chainEntry.message && <p className="mb-0 break-words text-sm text-fg-subtle">{chainEntry.message}</p>}
            </div>
          ) : metricsUnavailable ? (
            <div className="flex flex-col gap-2">
              {simpleLine}
              <p className="mb-0 text-sm text-fg-subtle">Install monitoring to see the chain strip.</p>
            </div>
          ) : progress ? (
            <EpochStrip progress={progress} networkLabel={networkLabel} clientLabel={client.label} peers={peersSample} />
          ) : (
            simpleLine
          )}
          {!isAdvanced && (
            <button
              type="button"
              className="self-start font-semibold text-accent hover:underline"
              aria-expanded={true}
              onClick={() => setDetailsOpen(false)}
            >
              Hide details
            </button>
          )}
        </>
      )}
    </section>
  );
}
