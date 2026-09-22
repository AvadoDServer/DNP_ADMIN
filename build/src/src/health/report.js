import { appTitle } from "./rules/apps";
import { appDiskUse } from "./rules/storage";

const gb = n => (n ? `${(n / 1e9).toFixed(1)} GB` : "?");

/** Plain-text support report. Deliberately excludes env values, logs, keys and public IPs. */
export function buildReport({ verdict, findings, packages, stats, params, chainData, userActionLogs, versions, now }) {
  const lines = [];
  lines.push("AVADO diagnostics report", `Created ${now.toISOString()}`, "");
  lines.push(`Health: ${verdict.label}`);
  for (const f of findings) lines.push(`- [${f.severity}] ${f.title}`);
  if (!findings.length) lines.push("- no findings");
  lines.push("", "Versions");
  for (const [k, v] of Object.entries(versions || {})) lines.push(`- ${k} ${v || "?"}`);
  lines.push("", "Box");
  lines.push(`- node id ${params.nodeid || "?"}`, `- internal IP ${params.internalIp || "?"}`);
  lines.push(`- CPU ${stats.cpu || "?"}, memory ${stats.memory || "?"}, disk ${stats.disk || "?"} of ${stats.diskTotal || "?"}`);
  lines.push("", "Apps");
  for (const p of packages || [])
    lines.push(`- ${appTitle(p)} (${p.name}) ${p.version || "?"} ${p.state || "?"}${p.isCore ? " [system]" : ""}, disk ${gb(appDiskUse(p))}`);
  lines.push("", "Chains");
  for (const c of chainData || []) lines.push(`- ${c.name}: ${c.syncing ? c.message || "syncing" : "synced"}`);
  lines.push("", "Recent activity");
  for (const l of (userActionLogs || []).slice(0, 20))
    lines.push(`- ${l.timestamp} ${l.level} ${String(l.event || "").split(".")[0]}: ${String(l.message || "").slice(0, 160)}`);
  return lines.join("\n");
}

export function mailtoReport(report, verdict, findings) {
  const subject = `AVADO support: ${verdict.label}`;
  const summary = [
    "Hi AVADO support,",
    "",
    "(Describe what you were doing and what went wrong.)",
    "",
    `Health: ${verdict.label}`,
    ...findings.slice(0, 8).map(f => `- [${f.severity}] ${f.title}`),
    "",
    "Please attach the diagnostics report you downloaded (Help → Download report).",
  ].join("\n");
  let body = summary;
  let url = `mailto:ziga@ava.do?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  while (url.length > 1800 && body.length > 200) {
    body = body.slice(0, body.length - 100);
    url = `mailto:ziga@ava.do?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return url;
}
