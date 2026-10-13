import { IPFS_PACKAGE } from "health/clients";

export const IPFS_RESTARTING_WHY =
  "IPFS stores the app packages your AVADO downloads. Its storage looks damaged, which happens after sudden power loss. Resetting it deletes only that cache; your apps and their data are not touched. Updates work again once IPFS is back.";
export const IPFS_MISSING_WHY =
  "IPFS stores the app packages your AVADO downloads. It is not set up on this AVADO right now, so nothing can be installed or updated. Resetting its storage sets it up again; your apps and their data are not touched.";

// Restarts in the last hour that count as "keeps restarting" when IPFS is
// up at the moment of the check.
export const IPFS_RESTARTS_PER_HOUR = 3;
// How long the result of a reset started from the finding stays on Home
export const IPFS_RESULT_NOTE_MS = 60 * 1000;

const FIX = { kind: "action", action: "resetIpfsData", label: "Reset IPFS storage" };

/**
 * IPFS keeps restarting, or is missing (DAPPMANAGER 10.0.52 getIpfsHealth,
 * fetched by HealthProvider as `ipfsHealth`): restarting right now,
 * restarted at least 3 times in the last hour, or no IPFS container at all.
 * One click resets its storage (which also sets a missing IPFS up again).
 *
 * `ipfsReset` is this page's own reset (pages/system/ipfsResetApi). While one
 * started from this finding runs, the finding stays, so its progress stays
 * where it was started; for a minute after it ended its result stays too
 * (an error on the finding, "Done: …" as a note of its own). Not hideable
 * while IPFS restarts or is missing. appRestarting leaves IPFS to this rule
 * whenever `ipfsHealth` is known.
 */
export function ipfsRestarting({ ipfsHealth: h, ipfsReset, now = Date.now() }) {
  if (!h || typeof h !== "object") return [];
  const status = ipfsReset && ipfsReset.status;
  const fromHere = Boolean(ipfsReset && ipfsReset.origin === "finding");
  const resetting = status === "running" || h.resetRunning === true;
  const ended =
    fromHere &&
    (status === "done" || status === "error") &&
    typeof ipfsReset.endedAt === "number" &&
    now - ipfsReset.endedAt < IPFS_RESULT_NOTE_MS;

  const restartsLastHour = Number(h.restartsLastHour) || 0;
  const missing = h.exists === false && !resetting;
  const unhealthy = h.exists === true && (h.restarting === true || restartsLastHour >= IPFS_RESTARTS_PER_HOUR);

  if (missing || unhealthy || (fromHere && status === "running") || (ended && status === "error")) {
    const lines = Array.isArray(h.lastLogLines) ? h.lastLogLines.filter(l => typeof l === "string" && l) : [];
    return [
      {
        id: "ipfs-restarting",
        severity: "critical",
        topic: "core",
        appId: IPFS_PACKAGE,
        title: missing ? "IPFS is missing" : "IPFS keeps restarting",
        why: missing ? IPFS_MISSING_WHY : IPFS_RESTARTING_WHY,
        // Advanced mode only (FindingRow): the last thing IPFS logged
        detail: lines.length ? `Last log line: ${lines[lines.length - 1]}` : undefined,
        fix: FIX,
        dismissable: !missing && h.restarting !== true && !(fromHere && (status === "running" || ended)),
      },
    ];
  }
  if (ended && status === "done") {
    return [
      {
        id: "ipfs-reset-done",
        severity: "info",
        topic: "core",
        appId: IPFS_PACKAGE,
        title: ipfsReset.text,
        dismissable: false,
      },
    ];
  }
  return [];
}
// Only a DAPPMANAGER of 10.0.52 or newer can say: without it the check never runs.
ipfsRestarting.needs = "ipfsHealth";
