import { appTitle } from "./rules/apps";
import { appDiskUse, formatDockerSize } from "./rules/storage";

/**
 * Plain-text support report. Deliberately excludes env values, logs, keys
 * and public IPs.
 *
 * `ready = false` (health/HealthProvider hasn't finished its first check
 * yet) reports "still checking" instead of the healthy-looking `verdict`
 * computed over an empty findings list — that would otherwise read as a
 * false "All good".
 */
export function buildReport({ verdict, findings, packages, stats, params, chainData, userActionLogs, versions, now, ready = true }) {
  const lines = [];
  lines.push("AVADO diagnostics report", `Created ${now.toISOString()}`, "");
  lines.push(`Health: ${ready ? verdict.label : "still checking"}`);
  for (const f of findings) lines.push(`- [${f.severity}] ${f.title}`);
  if (!findings.length) lines.push(ready ? "- no findings" : "- still checking, no findings yet");
  lines.push("", "Versions");
  for (const [k, v] of Object.entries(versions || {})) lines.push(`- ${k} ${v || "?"}`);
  lines.push("", "Box");
  lines.push(`- node id ${params.nodeid || "?"}`, `- internal IP ${params.internalIp || "?"}`);
  lines.push(`- CPU ${stats.cpu || "?"}, memory ${stats.memory || "?"}, disk ${stats.disk || "?"} of ${stats.diskTotal || "?"}`);
  lines.push("", "Apps");
  for (const p of packages || [])
    lines.push(`- ${appTitle(p)} (${p.name}) ${p.version || "?"} ${p.state || "?"}${p.isCore ? " [system]" : ""}, disk ${formatDockerSize(appDiskUse(p))}`);
  lines.push("", "Chains");
  for (const c of chainData || []) lines.push(`- ${c.name}: ${c.syncing ? c.message || "syncing" : "synced"}`);
  lines.push("", "Recent activity");
  for (const l of (userActionLogs || []).slice(0, 20))
    lines.push(`- ${l.timestamp} ${l.level} ${String(l.event || "").split(".")[0]}: ${String(l.message || "").slice(0, 160)}`);
  return lines.join("\n");
}

const ATTACH_LINE = "Please attach the diagnostics report you downloaded (Help → Download report).";

export function mailtoReport(report, verdict, findings, ready = true) {
  const healthLabel = ready ? verdict.label : "still checking";
  const subject = `AVADO support: ${healthLabel}`;

  const buildUrl = shownFindings => {
    const body = [
      "Hi AVADO support,",
      "",
      "(Describe what you were doing and what went wrong.)",
      "",
      `Health: ${healthLabel}`,
      ...shownFindings.map(f => `- [${f.severity}] ${f.title}`),
      "",
      ATTACH_LINE,
    ].join("\n");
    return `mailto:ziga@ava.do?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  let shown = findings.slice(0, 8);
  let url = buildUrl(shown);
  // Trim findings lines first (the least-severe of the ones shown, from the
  // end) rather than blindly truncating the body text, so the "Please
  // attach…" line — the actual point of this email — never gets cut off.
  while (url.length > 1800 && shown.length > 0) {
    shown = shown.slice(0, -1);
    url = buildUrl(shown);
  }
  return url;
}
