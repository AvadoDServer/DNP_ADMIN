import { appTitle } from "./rules/apps";
import { getClient, ROLES } from "./clients";

/**
 * Reading DAPPMANAGER getDiagnostics (10.0.53, shape in
 * health/__tests__/fixtures-diagnostics.js) for the support report and the
 * process rules. Everything here is pure.
 */

const SEVERITY_ORDER = ["critical", "warning", "info"];
// supervisord states that mean "the program runs, or is about to"
// supervisord states a program only reaches by failing: a crash that gave up
// (FATAL), one that is being retried (BACKOFF), or an exit it did not expect
// (EXITED). STOPPED is only ever reached through a stop request (the Stop
// button on the app's own page, or its restart in progress), so it is never
// "down": restarting a validator the owner stopped could get it slashed.
const PROCESS_FAILED = new Set(["FATAL", "BACKOFF", "EXITED"]);
// The box restarting this long after a "Restart" from the Admin was that restart
export const REBOOT_EXPLAINS_MS = 15 * 60 * 1000;
export const LAST_ERROR_MAX = 160;

const shortName = (name = "") => String(name).split(".")[0];
const num = v => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* ---------------- scrubbing ---------------- */

// The same rules as the DAPPMANAGER's scrubber (modules/diagnostics/scrub.js),
// applied again to every line the report prints from the box: a secret that
// slipped through there must still never reach the report.
const SCRUB_RULES = [
  [/\b[0-9a-fA-F]{64,}\b/g, m => `${m.slice(0, 6)}…`],
  [/(password|passphrase|token|secret|mnemonic|seed|jwt|apikey|api_key|private[_-]?key)(\s*[=:]\s*)\S+/gi, (m, k) => `${k}=<redacted>`],
  [/Bearer\s+\S+/g, () => "Bearer <redacted>"],
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, (m, scheme) => `${scheme}<redacted>@`],
  [/\b(?:[a-z]+[ \t]+){11,}[a-z]+\b/g, () => "<12+ words redacted>"],
];

export function scrub(text) {
  let s = String(text == null ? "" : text);
  for (const [re, fn] of SCRUB_RULES) s = s.replace(re, fn);
  return s;
}

/* ---------------- small formatters ---------------- */

/** 444217 -> "5 days 3 h", 4161 -> "1 h 9 min", 50 -> "50 s" */
export function formatDuration(seconds) {
  const s = num(seconds);
  if (s == null || s < 0) return "?";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} day${d === 1 ? "" : "s"}${h ? ` ${h} h` : ""}`;
  if (h) return `${h} h${m ? ` ${m} min` : ""}`;
  if (m) return `${m} min`;
  return `${Math.floor(s)} s`;
}

// "2026-10-14T10:36:52.341901234Z 2026-10-14 10:36:52.341 FATAL - …" -> "FATAL - …"
const stripTimestamps = line =>
  String(line)
    .replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z?\s+/, "")
    .replace(/^\d{4}-\d\d-\d\d[ T][\d:.,]+(\+\d\d:\d\d)?\s+/, "");

// Keeps the start and the end (where the cause usually is) of a long line.
export function clip(text, max = LAST_ERROR_MAX) {
  const s = String(text);
  if (s.length <= max) return s;
  const head = Math.ceil((max - 1) / 2);
  return `${s.slice(0, head)}…${s.slice(s.length - (max - 1 - head))}`;
}

// supervisord's own bookkeeping ("exited: teku (exit status 2…)", "gave up:
// teku entered FATAL state") matches the error filter but says nothing new.
const SUPERVISOR_LINE = /\b(INFO|WARN|CRIT) (exited|gave up|spawned|success|stopped|waiting for|reaped unknown pid):/;

// A line the program itself marked as an error (not one that only mentions
// "failed" or "timeout", like a helper's request log)
const LEVEL_LINE = /\b(FATAL|ERROR|ERRO|ERR|CRIT|CRITICAL|PANIC|panic|Exception)\b/;

/**
 * The app's last error line (scrubbed, without timestamps, ≤160 chars), or
 * null: the last one with an error level, else the last one that is not
 * supervisord's own bookkeeping, else the last one.
 */
export function lastError(container) {
  const line = lastErrorLine(container);
  return line ? clip(line) : null;
}

// lastError, not clipped
function lastErrorLine(container) {
  const errors = ((container && container.log && Array.isArray(container.log.errors) && container.log.errors) || []).filter(
    l => typeof l === "string" && l
  );
  const useful = errors.filter(l => !SUPERVISOR_LINE.test(l));
  const levelled = useful.filter(l => LEVEL_LINE.test(stripTimestamps(l)));
  const line = levelled[levelled.length - 1] || useful[useful.length - 1] || errors[errors.length - 1];
  return line ? scrub(stripTimestamps(line)) : null;
}

/* ---------------- lookups ---------------- */

export function titleOf(id, packages) {
  const p = (packages || []).find(x => x && x.name === id);
  return p ? appTitle(p) : shortName(id);
}

const isChainClient = id => {
  const c = getClient(id);
  return Boolean(c && (c.role === ROLES.EXECUTION || c.role === ROLES.CONSENSUS));
};

/** supervisord programs that failed (FATAL, BACKOFF, EXITED) inside a running container. */
export function processesDown(container) {
  if (!container || container.state !== "running") return [];
  return (container.processes || []).filter(p => p && PROCESS_FAILED.has(p.state));
}

/**
 * Programs stopped on purpose inside a running container: STOPPED, and
 * STOPPING (which the DAPPMANAGER sends as UNKNOWN "STOPPING …"). Never a
 * finding, only an info line in the report.
 */
export function processesStopped(container) {
  if (!container || container.state !== "running") return [];
  return (container.processes || []).filter(
    p => p && (p.state === "STOPPED" || (p.state === "UNKNOWN" && /^STOPPING\b/.test(String(p.description || "").trim())))
  );
}

// The DAPPMANAGER's catalogue error names the step that failed first:
// "rpc.ava.do: …" (the AVADO update server) or "IPFS: …".
const CATALOGUE_STEP = /^\s*(rpc\.ava\.do|IPFS)\s*:\s*/i;

/**
 * "Can't check for updates" — the first failing link of DNS → internet →
 * IPFS → the step the catalogue error names (the update server, or IPFS
 * fetching it) → store nodes. `internet.ok` is true for any HTTP answer
 * (even a 404): only no answer at all is "no internet".
 */
export function storeCause(network) {
  const store = (network && network.store) || {};
  const dns = Object.values((network && network.dns && network.dns.resolves) || {});
  if (dns.some(r => r && r.ok === false)) return "the box cannot resolve internet names (DNS)";
  const web = Object.values((network && network.internet) || {});
  const offline = web.find(r => r && r.ok === false);
  if (offline) return `the box has no internet connection (${scrub(offline.error || "no answer")})`;
  const ipfs = store.ipfs;
  if (ipfs && (ipfs.restarting || ipfs.running === false)) {
    const lines = Array.isArray(ipfs.lastLogLines) ? ipfs.lastLogLines.filter(Boolean) : [];
    const last = lines.length ? `, last line: ${clip(scrub(lines[lines.length - 1]), 120)}` : "";
    return ipfs.restarting
      ? `IPFS is restarting (${num(ipfs.restartCount) ?? "?"} restarts${last})`
      : `IPFS is not running${last ? ` (${last.slice(2)})` : ""}`;
  }
  const noStorePeers = ipfs && ipfs.storePeersConnected === 0;
  const storePeersText = () => `IPFS is not connected to the AVADO store nodes (peers: ${num(ipfs.peers) ?? "?"})`;
  const error = String((store.catalogue && store.catalogue.error) || "");
  const step = error.match(CATALOGUE_STEP);
  const detail = scrub(error.replace(CATALOGUE_STEP, "")) || "no answer";
  if (step && step[1].toLowerCase() === "rpc.ava.do") return `the AVADO update server did not answer (${detail})`;
  if (step) return `IPFS could not fetch the catalogue (${detail})${noStorePeers ? `; ${storePeersText()}` : ""}`;
  // No step named: the DAPPMANAGER's error as it came
  return scrub(error || "the store did not answer");
}

const isWifi = (name, interfaces) => {
  const i = (interfaces || []).find(x => x && x.name === name);
  return i ? i.type === "wifi" : /^wl/.test(String(name || ""));
};

/* ---------------- "What we found" ---------------- */

/**
 * The problems a support person can act on, read from getDiagnostics: one
 * line each, most severe first. [] when nothing is wrong (or no diagnostics).
 * @returns {{ severity: "critical"|"warning"|"info", text: string, appId?: string }[]}
 */
export function deriveProblems(diagnostics, packages, userActionLogs, now = new Date()) {
  const d = diagnostics && typeof diagnostics === "object" ? diagnostics : null;
  if (!d) return [];
  const out = [];
  const add = (severity, text, appId) => out.push({ severity, text, appId });
  const containers = Array.isArray(d.containers) ? d.containers.filter(Boolean) : [];
  const byId = Object.fromEntries(containers.map(c => [c.id, c]));

  // 1, 2: inside and outside each container
  for (const c of containers) {
    const title = titleOf(c.id, packages);
    const important = c.isCore || isChainClient(c.id);
    for (const p of processesDown(c)) {
      const full = lastErrorLine(c);
      const err = full && clip(full);
      const checkpoint = c.settings && c.settings.initial_state;
      const aboutCheckpoint = full && checkpoint && /initial state|checkpoint/i.test(full);
      add(
        isChainClient(c.id) ? "critical" : "warning",
        `${title}: the ${p.name} process is not running (${p.state}: ${scrub(p.description || "no description")}).` +
          (err ? ` Last error: "${err}"` : "") +
          (aboutCheckpoint ? `. Checkpoint URL in use: ${scrub(checkpoint)}` : ""),
        c.id
      );
    }
    for (const p of processesStopped(c))
      add("info", `${title}: the ${p.name} process is ${p.state === "STOPPED" ? "stopped" : "stopping"} (stopped from the app)`, c.id);
    let stateSaid = false;
    if (["exited", "dead", "restarting"].includes(c.state)) {
      stateSaid = true;
      add(important ? "critical" : "warning", `${title} is ${c.state} (exit code ${c.exitCode ?? "?"}, ${c.status || "no status"})`, c.id);
    }
    if (c.oomKilled) add("warning", `${title} was killed because the box ran out of memory`, c.id);
    if (!stateSaid && num(c.restartCount) >= 3 && num(c.uptimeSeconds) != null && c.uptimeSeconds < 3600)
      add("warning", `${title} restarted ${c.restartCount} times recently`, c.id);
  }

  // 3: the store
  const network = d.network;
  const catalogue = network && network.store && network.store.catalogue;
  if (catalogue && catalogue.ok === false) add("warning", `Can't check for updates because ${storeCause(network)}`);

  // 4: Wi-Fi
  const route = network && network.defaultRoute;
  if (route && route.interface && isWifi(route.interface, network.interfaces)) {
    const deadEthernet = (network.interfaces || []).some(i => i && i.type === "ethernet" && i.carrier === false);
    add(
      deadEthernet ? "warning" : "info",
      `The box uses Wi-Fi (${route.interface}) for its internet connection${deadEthernet ? "; the Ethernet port has no link" : ""}`
    );
  }

  // 5..8: the box itself
  const host = d.host;
  if (host) {
    const up = num(host.uptimeSeconds);
    const bootedAt = Date.parse(host.bootedAt) || (up != null ? now.getTime() - up * 1000 : NaN);
    // rebootHost (the AVADO dashboard's Restart) is in the activity log from
    // DAPPMANAGER 10.0.53, a moment before the boot it causes
    if (up != null && up < 86400) {
      const asked = (userActionLogs || []).some(l => {
        const t = Date.parse(l && l.timestamp);
        return /^rebootHost\b/.test(String((l && l.event) || "")) && t >= bootedAt - REBOOT_EXPLAINS_MS && t <= bootedAt + 5 * 60 * 1000;
      });
      if (!asked)
        add(
          up < 6 * 3600 ? "warning" : "info",
          `The box restarted ${formatDuration(up)} ago without a reboot from the AVADO dashboard (power loss, crash or a reboot from the terminal)`
        );
    }
    const dmesg = host.dmesg || {};
    if ((dmesg.oom || []).length) add("warning", `The system killed processes for lack of memory (${dmesg.oom.length} times in the kernel log)`);
    if ((dmesg.hardware || []).length) add("critical", `Kernel reports hardware errors: "${clip(scrub(dmesg.hardware[0]))}"`);
    if ((dmesg.network || []).length >= 3) add("warning", `The network link went down and up ${dmesg.network.length} times`);
    for (const t of host.temperatures || []) if (t && num(t.celsius) >= 80) add("warning", `${t.name} is at ${t.celsius} °C`);
    const total = num(host.memTotalMB);
    const avail = num(host.memAvailableMB);
    const swapTotal = num(host.swapTotalMB) || 0;
    const swapUsed = num(host.swapUsedMB) || 0;
    if (total && avail != null && avail / total < 0.05 && (swapTotal === 0 || swapUsed / swapTotal >= 0.9))
      add("critical", `The box is out of memory (${avail} MB of ${total} MB free, swap ${swapUsed} of ${swapTotal} MB used)`);
  }

  // 9: the clients' own view
  for (const c of Array.isArray(d.clients) ? d.clients : []) {
    if (!c || !c.id) continue;
    const title = titleOf(c.id, packages);
    const api = c.api || {};
    const container = byId[c.id];
    const running = container ? container.state === "running" && !processesDown(container).length && !processesStopped(container).length : true;
    if (api.reachable === false) {
      const what = c.role === "validator" ? "key manager" : "API";
      if (running) add("critical", `${title}'s ${what} does not answer${api.error ? ` (${scrub(api.error)})` : ""}`, c.id);
      continue;
    }
    const s = api.syncing || {};
    if (c.role === "beacon") {
      if (s.isSyncing || num(s.syncDistance) > 100) add("warning", `${title} is syncing (${num(s.syncDistance) ?? "?"} slots behind)`, c.id);
      if (s.elOffline) add("critical", `${title} is not connected to the execution client`, c.id);
    }
    if (c.role === "execution" && s.synced === false)
      add("warning", `${title} is syncing (block ${num(s.currentBlock) ?? "?"} of ${num(s.highestBlock) ?? "?"})`, c.id);
    if (num(api.peers) != null && api.peers < 10) add("warning", `${title} has only ${api.peers} peers`, c.id);
    // A validator client only (Prysm's eth2validator): Teku, Nimbus and
    // Lighthouse report their keys too, but a beacon node without keys is normal.
    if (c.role === "validator" && c.validators && c.validators.count === 0) add("warning", `${title} has no validator keys`, c.id);
  }

  const rank = s => (SEVERITY_ORDER.indexOf(s) === -1 ? SEVERITY_ORDER.length : SEVERITY_ORDER.indexOf(s));
  return out.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p.severity) - rank(b.p.severity) || a.i - b.i).map(x => x.p);
}

