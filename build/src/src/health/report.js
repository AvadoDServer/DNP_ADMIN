import { appTitle } from "./rules/apps";
import { appDiskUse, formatDockerSize } from "./rules/storage";
import { canGetDiagnostics, DIAGNOSTICS_SINCE } from "./clients";
import { deriveProblems, formatDuration, scrub, titleOf } from "./diagnostics";

// The whole report stays under this; log lines go first (oldest first).
export const REPORT_MAX_CHARS = 200000;
// One log line longer than this is cut (a stack trace on one line).
const LOG_LINE_MAX = 2000;
const LOG_LINES_SHOWN = 20;
const CORE_LOGS = new Set(["ipfs.dnp.dappnode.eth", "dappmanager.dnp.dappnode.eth"]);
// Client settings worth reading, in this order (only the ones that exist are printed).
const SETTING_LABELS = [
  ["execution_engine", "execution client"],
  ["ee_endpoint", "execution endpoint"],
  ["initial_state", "checkpoint URL"],
  ["checkpoint_sync_url", "checkpoint URL"],
  ["validators_proposer_default_fee_recipient", "fee recipient"],
  ["fee_recipient", "fee recipient"],
  ["suggested_fee_recipient", "fee recipient"],
  ["mev_boost", "MEV-Boost"],
];

const gb = mb =>
  typeof mb !== "number" || !Number.isFinite(mb) ? "?" : mb < 1024 ? `${Math.round(mb)} MB` : `${(mb / 1024).toFixed(1)} GB`;
const or = (v, fallback = "?") => (v === null || v === undefined || v === "" ? fallback : v);
const logLine = l => {
  const s = scrub(l);
  return s.length > LOG_LINE_MAX ? `${s.slice(0, LOG_LINE_MAX)}… (line cut)` : s;
};

function findingLines(f) {
  const lines = [`- [${f.severity}] ${f.title}`];
  if (f.why) lines.push(`    Why: ${f.why}`);
  const first = (Array.isArray(f.steps) && f.steps[0]) || (f.fix && f.fix.label);
  if (first) lines.push(`    Fix: ${first}`);
  return lines;
}

function boxLines(d) {
  const lines = [];
  const h = d.host;
  if (!h) {
    lines.push("- host details not collected");
  } else {
    lines.push(`- up ${formatDuration(h.uptimeSeconds)}, booted at ${or(h.bootedAt)}`);
    const load = Array.isArray(h.loadavg) ? h.loadavg.join(" ") : "?";
    lines.push(`- load ${load} on ${or(h.cores)} cores`);
    const used = typeof h.memTotalMB === "number" && typeof h.memAvailableMB === "number" ? h.memTotalMB - h.memAvailableMB : null;
    lines.push(`- memory ${gb(used)} used of ${gb(h.memTotalMB)}, swap ${gb(h.swapUsedMB)} used of ${gb(h.swapTotalMB)}`);
    const disk = h.rootDisk || {};
    lines.push(`- system disk ${or(disk.usedGB)} GB used of ${or(disk.totalGB)} GB (${or(disk.availableGB)} GB free)`);
    lines.push(`- ${or(h.os, "unknown OS")}, kernel ${or(h.kernel)}`);
    const temps = (h.temperatures || []).filter(Boolean).map(t => `${t.name} ${t.celsius} °C`);
    lines.push(`- temperatures: ${temps.length ? temps.join(", ") : "none reported"}`);
    const dmesg = h.dmesg || {};
    for (const [key, label] of [["oom", "out of memory"], ["hardware", "hardware"], ["network", "network"]]) {
      const found = Array.isArray(dmesg[key]) ? dmesg[key] : [];
      lines.push(`- kernel log, ${label}: ${found.length ? `${found.length} line${found.length === 1 ? "" : "s"}` : "nothing"}`);
      for (const l of found) lines.push(`    ${logLine(l)}`);
    }
  }
  if (Array.isArray(d.errors) && d.errors.length) lines.push(`- could not read: ${d.errors.map(scrub).join("; ")}`);
  lines.push(`- collected at ${or(d.collectedAt)} in ${or(d.durationMs)} ms`);
  return lines;
}

function networkLines(n) {
  if (!n) return ["- not collected"];
  const lines = [];
  for (const i of n.interfaces || []) {
    if (!i || i.name === "lo" || /^veth/.test(i.name)) continue;
    const ips = (i.ipv4 || []).join(", ");
    lines.push(`- ${i.name} ${i.type} ${i.up ? "up" : "down"} ${i.carrier ? "link" : "no link"}${ips ? ` ${ips}` : ""}`);
  }
  const r = n.defaultRoute;
  lines.push(r ? `- default route via ${r.interface} (gateway ${or(r.gateway)})` : "- no default route");
  const dns = Object.entries((n.dns && n.dns.resolves) || {}).map(
    ([name, v]) => `${name} ${v && v.ok ? `ok ${or(v.ms)} ms` : `failed (${scrub((v && v.error) || "no answer")})`}`
  );
  lines.push(`- DNS: ${dns.length ? dns.join(", ") : "not checked"}`);
  for (const [url, v] of Object.entries(n.internet || {}))
    lines.push(`- internet ${url}: ${v && v.ok ? `ok (${or(v.status)}, ${or(v.ms)} ms)` : `failed (${scrub((v && (v.error || v.status)) || "no answer")})`}`);
  const store = n.store || {};
  const ipfs = store.ipfs;
  if (ipfs) {
    const state = ipfs.restarting ? "restarting" : ipfs.running ? "running" : "not running";
    lines.push(
      `- IPFS ${state}, restarts ${or(ipfs.restartCount)} (${or(ipfs.restartsLastHour)} in the last hour), peers ${or(ipfs.peers)}, AVADO store nodes ${or(ipfs.storePeersConnected)} of ${or(ipfs.storePeersTotal)}`
    );
    for (const l of (ipfs.lastLogLines || []).slice(-5)) lines.push(`    ${logLine(l)}`);
  }
  const cat = store.catalogue;
  if (cat) lines.push(`- store catalogue: ${cat.ok ? `ok in ${or(cat.ms)} ms` : `failed after ${or(cat.ms)} ms (${scrub(cat.error || "no answer")})`}`);
  return lines;
}

function appLines(d, packages) {
  const lines = [];
  const byName = Object.fromEntries((packages || []).filter(Boolean).map(p => [p.name, p]));
  const seen = new Set();
  for (const c of d.containers || []) {
    if (!c) continue;
    seen.add(c.id);
    const p = byName[c.id];
    lines.push(
      `- ${titleOf(c.id, packages)} (${c.id}) ${or(c.version || (p && p.version))} ${or(c.state)}, ${or(c.status)}, restarts ${or(c.restartCount)}, exit ${or(c.exitCode)}` +
        `${c.oomKilled ? ", OOM-killed" : ""}${c.isCore ? " [system]" : ""}${p ? `, disk ${formatDockerSize(appDiskUse(p))}` : ""}`
    );
  }
  for (const p of packages || []) {
    if (p && !seen.has(p.name)) lines.push(`- ${appTitle(p)} (${p.name}) ${p.version || "?"} ${p.state || "?"}: no container found`);
  }
  return lines;
}

function processLines(d, packages) {
  const lines = [];
  for (const c of d.containers || []) {
    if (!c || !Array.isArray(c.processes) || !c.processes.length) continue;
    lines.push(`- ${titleOf(c.id, packages)}`);
    for (const p of c.processes) lines.push(`    ${p.name} ${p.state} ${scrub(p.description || "")}`.trimEnd());
  }
  return lines.length ? lines : ["- no app reports the programs inside it"];
}

function syncLine(c) {
  const api = c.api || {};
  // A validator client (Prysm's eth2validator) is read through its key manager only
  const what = c.role === "validator" ? "key manager" : "API";
  if (api.reachable === false) return `${what} not answering (${scrub(api.error || "no answer")})`;
  if (!api.reachable) return `${what} not checked`;
  if (c.role === "validator" && !api.version && !api.syncing && typeof api.peers !== "number") return "key manager answering";
  const parts = [api.version ? scrub(api.version) : "version unknown"];
  const s = api.syncing;
  if (s && "syncDistance" in s)
    parts.push(
      `${s.isSyncing ? "syncing" : "synced"}, head slot ${or(s.headSlot)}, ${or(s.syncDistance)} slots behind` +
        `${s.isOptimistic ? ", optimistic" : ""}${s.elOffline ? ", execution client offline" : ""}`
    );
  else if (s && "currentBlock" in s) parts.push(`${s.synced ? "synced" : "syncing"}, block ${or(s.currentBlock)} of ${or(s.highestBlock)}`);
  if (typeof api.peers === "number") parts.push(`${api.peers} peers`);
  return parts.join(", ");
}

function clientLines(d, packages) {
  const clients = Array.isArray(d.clients) ? d.clients.filter(Boolean) : [];
  if (!clients.length) return ["- none found"];
  const lines = [];
  for (const c of clients) {
    lines.push(`- ${titleOf(c.id, packages)}: ${c.role} (${or(c.client)}, ${or(c.network)}), ${syncLine(c)}`);
    if (c.validators && typeof c.validators.count === "number") lines.push(`    validator keys: ${c.validators.count}`);
    const container = (d.containers || []).find(x => x && x.id === c.id);
    const settings = (container && container.settings) || {};
    for (const [key, label] of SETTING_LABELS) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) lines.push(`    ${label} (${key}): ${scrub(String(settings[key]))}`);
    }
  }
  return lines;
}

// One block per app whose logs support reads: every app, plus IPFS and the
// DAPPMANAGER among the system ones.
function logBlocks(d, packages) {
  return (d.containers || [])
    .filter(c => c && c.log && (!c.isCore || CORE_LOGS.has(c.id)))
    .map(c => ({
      title: `${titleOf(c.id, packages)} (${c.id})`,
      errorCount: c.log.errorCount,
      errors: (c.log.errors || []).map(logLine),
      lines: (c.log.lines || []).slice(-LOG_LINES_SHOWN).map(logLine),
      left: 0,
    }));
}

function renderLogs(blocks) {
  if (!blocks.length) return ["- not collected"];
  const lines = [];
  for (const b of blocks) {
    lines.push(`- ${b.title}: ${or(b.errorCount, 0)} error lines in the last 500`);
    if (b.errors.length) lines.push("    last errors:", ...b.errors.map(l => `      ${l}`));
    if (b.lines.length || b.left) lines.push(`    last lines${b.left ? ` (${b.left} older left out)` : ""}:`, ...b.lines.map(l => `      ${l}`));
  }
  return lines;
}

/**
 * Plain-text support report. Never holds env values or the public IP; log
 * lines, programs and client settings come scrubbed by the DAPPMANAGER and
 * are scrubbed here again (health/diagnostics.js scrub).
 *
 * `ready = false` (health/HealthProvider hasn't finished its first check
 * yet) reports "still checking" instead of the healthy-looking `verdict`
 * computed over an empty findings list — that would otherwise read as a
 * false "All good".
 *
 * `diagnostics`: DAPPMANAGER getDiagnostics (10.0.53), null while it is
 * collected, when it failed (`diagnosticsError`) or on an older core.
 */
export function buildReport({
  verdict,
  findings,
  packages,
  stats,
  params,
  chainData,
  userActionLogs,
  versions,
  now,
  ready = true,
  diagnostics = null,
  diagnosticsError = null,
  diagnosticsLoading = false,
}) {
  const d = diagnostics && typeof diagnostics === "object" ? diagnostics : null;
  const head = [];
  head.push("AVADO diagnostics report", `Created ${now.toISOString()}`, "");
  head.push(`Health: ${ready ? verdict.label : "still checking"}`);
  for (const f of findings) head.push(...findingLines(f));
  if (!findings.length) head.push(ready ? "- no findings" : "- still checking, no findings yet");

  head.push("", "What we found");
  if (d) {
    const problems = deriveProblems(d, packages, userActionLogs, now);
    for (const p of problems) head.push(`- [${p.severity}] ${p.text}`);
    if (!problems.length) head.push("- nothing beyond the health findings");
  } else {
    head.push("- box details not collected (see Box)");
  }

  head.push("", "Versions");
  for (const [k, v] of Object.entries(versions || {})) head.push(`- ${k} ${v || "?"}`);
  head.push("", "Box");
  // The core sends `internalip` (DAPPMANAGER getParams); `internalIp` is the old spelling.
  head.push(`- node id ${params.nodeid || "?"}`, `- internal IP ${params.internalip || params.internalIp || "?"}`);
  head.push(`- CPU ${stats.cpu || "?"}, memory ${stats.memory || "?"}, disk ${stats.disk || "?"} of ${stats.diskTotal || "?"}`);
  if (d) head.push(...boxLines(d));
  else if (!canGetDiagnostics(packages, versions && versions.dappmanager)) head.push(`- Box details need DAPPMANAGER ${DIAGNOSTICS_SINCE} or newer`);
  else if (diagnosticsError) head.push(`- Box details: could not be collected: ${scrub(diagnosticsError)}`);
  else if (diagnosticsLoading) head.push("- Box details: still collecting");
  else head.push("- Box details: not collected");

  if (d) head.push("", "Network", ...networkLines(d.network));
  head.push("", "Apps");
  if (d) head.push(...appLines(d, packages));
  else
    for (const p of packages || [])
      head.push(`- ${appTitle(p)} (${p.name}) ${p.version || "?"} ${p.state || "?"}${p.isCore ? " [system]" : ""}, disk ${formatDockerSize(appDiskUse(p))}`);
  if (d) head.push("", "Processes", ...processLines(d, packages), "", "Clients", ...clientLines(d, packages));
  head.push("", "Chains");
  for (const c of chainData || []) head.push(`- ${c.name}: ${c.syncing ? c.message || "syncing" : "synced"}`);

  const tail = ["", "Recent activity"];
  for (const l of (userActionLogs || []).slice(0, 20))
    tail.push(`- ${l.timestamp} ${l.level} ${String(l.event || "").split(".")[0]}: ${String(l.message || "").slice(0, 160)}`);

  const blocks = d ? logBlocks(d, packages) : null;
  const render = () => [...head, ...(blocks ? ["", "Logs", ...renderLogs(blocks)] : []), ...tail].join("\n");
  let text = render();
  if (text.length > REPORT_MAX_CHARS && blocks) {
    // Trim log lines first: the oldest line of the app with the most lines left
    let over = text.length - REPORT_MAX_CHARS + 200;
    while (over > 0) {
      const b = blocks.reduce((a, x) => (x.lines.length > a.lines.length ? x : a), blocks[0]);
      if (b.lines.length) {
        over -= b.lines.shift().length + 7;
        b.left++;
        continue;
      }
      const e = blocks.find(x => x.errors.length);
      if (!e) break;
      over -= e.errors.shift().length + 7;
    }
    text = render();
  }
  if (text.length > REPORT_MAX_CHARS) text = `${text.slice(0, REPORT_MAX_CHARS - 60)}\n… report cut at ${REPORT_MAX_CHARS} characters`;
  return text;
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
