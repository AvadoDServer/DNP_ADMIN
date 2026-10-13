import { IPFS_PACKAGE } from "health/clients";

export const IPFS_RESTARTING_WHY =
  "IPFS stores the app packages your AVADO downloads. Its storage looks damaged, which happens after sudden power loss. Resetting it deletes only that cache; your apps and their data are not touched. Updates work again once IPFS is back.";

// Restarts in the last hour that count as "keeps restarting" when IPFS is
// up at the moment of the check.
export const IPFS_RESTARTS_PER_HOUR = 3;

/**
 * IPFS keeps restarting (DAPPMANAGER 10.0.52 getIpfsHealth, fetched by
 * HealthProvider as `ipfsHealth`): restarting right now, or restarted at
 * least 3 times in the last hour. One click resets its storage.
 *
 * While a reset started from this finding runs (`ipfsReset`, this page's
 * own state; or the DAPPMANAGER's resetRunning), the finding stays, so its
 * progress stays where it was started. Not hideable while IPFS restarts.
 * appRestarting leaves IPFS to this rule whenever `ipfsHealth` is known.
 */
export function ipfsRestarting({ ipfsHealth: h, ipfsReset }) {
  if (!h || typeof h !== "object") return [];
  const restartsLastHour = Number(h.restartsLastHour) || 0;
  const unhealthy = Boolean(h.exists) && (h.restarting === true || restartsLastHour >= IPFS_RESTARTS_PER_HOUR);
  const fromHere = Boolean(ipfsReset && ipfsReset.origin === "finding" && ipfsReset.status === "running");
  if (!unhealthy && !fromHere) return [];
  const lines = Array.isArray(h.lastLogLines) ? h.lastLogLines.filter(l => typeof l === "string" && l) : [];
  return [
    {
      id: "ipfs-restarting",
      severity: "critical",
      topic: "core",
      appId: IPFS_PACKAGE,
      title: "IPFS keeps restarting",
      why: IPFS_RESTARTING_WHY,
      // Advanced mode only (FindingRow): the last thing IPFS logged
      detail: lines.length ? `Last log line: ${lines[lines.length - 1]}` : undefined,
      fix: { kind: "action", action: "resetIpfsData", label: "Reset IPFS storage" },
      dismissable: !h.restarting && !fromHere,
    },
  ];
}
// Only a DAPPMANAGER of 10.0.52 or newer can say: without it the check never runs.
ipfsRestarting.needs = "ipfsHealth";
