import { getClient, ROLES, IPFS_PACKAGE } from "health/clients";
import { lastError, processesDown, titleOf } from "health/diagnostics";

/**
 * What happens inside each app's container (DAPPMANAGER 10.0.53
 * getDiagnostics, fetched by HealthProvider as `diagnostics` every minute,
 * containers and their programs only). A container can be "running" while
 * the program that does the work has stopped: the app list then says
 * running and nothing else would notice. Only a program that failed counts
 * (health/diagnostics.js processesDown): one stopped from the app's own page
 * is never a finding, and never gets a Restart (its keys may run elsewhere).
 */

const isChainClient = id => {
  const c = getClient(id);
  return Boolean(c && (c.role === ROLES.EXECUTION || c.role === ROLES.CONSENSUS));
};
const containersOf = diagnostics =>
  diagnostics && Array.isArray(diagnostics.containers) ? diagnostics.containers.filter(c => c && c.id) : [];
const packageOf = (id, packages) => (packages || []).find(p => p && p.name === id);
const logsLink = id => `/packages/${id}?tab=logs`;

// A system app is restarted from System, not with the app's own restart
const restartFix = (c, title) =>
  c.isCore ? { kind: "link", to: "/system", label: "Open System" } : { kind: "action", action: "restartPackage", label: `Restart ${title}` };

export function processDown({ diagnostics, packages }) {
  const out = [];
  for (const c of containersOf(diagnostics)) {
    const down = processesDown(c);
    if (!down.length) continue;
    const title = titleOf(c.id, packages);
    const client = isChainClient(c.id);
    const err = lastError(c);
    out.push({
      id: `process-down:${c.id}`,
      severity: client ? "critical" : "warning",
      topic: c.isCore ? "core" : "sync",
      appId: c.id,
      title: `${title} is not running inside its container`,
      why:
        `${title} shows as running, but the program that does its work failed and is not being started again.` +
        (client ? " Until it runs, your validators miss attestations and rewards." : " Anything that depends on it does not work meanwhile.") +
        " A restart often fixes it; if it stops again, the reason is in its logs.",
      // Advanced mode only (FindingRow): the program and what it last said
      detail: [`${down.map(p => `${p.name} ${p.state}: ${p.description || "no description"}`).join("; ")}`, err && `Last error: ${err}`]
        .filter(Boolean)
        .join(". "),
      fix: restartFix(c, title),
      secondary: { kind: "link", to: logsLink(c.id), label: "See why in the logs" },
    });
  }
  return out;
}
processDown.needs = "diagnostics";

export function appOomKilled({ diagnostics, packages }) {
  return containersOf(diagnostics)
    .filter(c => c.oomKilled === true)
    .map(c => {
      const title = titleOf(c.id, packages);
      return {
        id: `app-oom-killed:${c.id}`,
        severity: "warning",
        topic: c.isCore ? "core" : "sync",
        appId: c.id,
        title: `${title} was stopped because your AVADO ran out of memory`,
        why: "Your AVADO needed more memory than it has, so it stopped this app. It happens when too many apps run at once or one of them uses far more memory than usual.",
        fix: { kind: "steps", label: "What to do" },
        steps: [
          "Remove apps you no longer use (each app uses memory while it runs).",
          "Restart the app; if it is stopped again, download the diagnostics report in Help and send it to support.",
        ],
      };
    });
}
appOomKilled.needs = "diagnostics";

// Restarted this often by Docker while its current run is younger than an hour
export const CRASH_LOOP_RESTARTS = 3;
const CRASH_LOOP_UPTIME_S = 3600;

/**
 * Docker keeps restarting the app (a container in state "restarting" is
 * left to appRestarting, IPFS to ipfsRestarting once its health is known).
 */
export function appCrashLooping({ diagnostics, packages, ipfsHealth }) {
  return containersOf(diagnostics)
    .filter(c => c.restartCount >= CRASH_LOOP_RESTARTS && typeof c.uptimeSeconds === "number" && c.uptimeSeconds < CRASH_LOOP_UPTIME_S)
    .filter(c => c.state !== "restarting" && (packageOf(c.id, packages) || {}).state !== "restarting")
    .filter(c => !(ipfsHealth && c.id === IPFS_PACKAGE))
    .map(c => {
      const title = titleOf(c.id, packages);
      return {
        id: `app-crash-looping:${c.id}`,
        severity: isChainClient(c.id) ? "critical" : "warning",
        topic: c.isCore ? "core" : "sync",
        appId: c.id,
        title: `${title} keeps restarting`,
        why: `It stopped and was started again ${c.restartCount} times, the last time less than an hour ago. The reason is almost always in the last lines of its logs.`,
        fix: { kind: "link", to: logsLink(c.id), label: "Open the logs" },
        steps: [
          "Open the logs and look at the last error before the restart.",
          "If it says the disk is full, free space in System → Storage.",
          "Still restarting? Download the diagnostics report in Help and send it to support.",
        ],
      };
    });
}
appCrashLooping.needs = "diagnostics";
