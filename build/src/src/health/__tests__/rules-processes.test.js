import { processDown, appOomKilled, appCrashLooping } from "health/rules/processes";
import { ALL_RULES } from "health/rules";
import { runChecksDetailed } from "health/engine";
import { canGetDiagnostics, DIAGNOSTICS_SINCE } from "health/clients";
import { ticket0928, healthy } from "./fixtures-diagnostics";
import { snapshot } from "./fixtures";

const clone = v => JSON.parse(JSON.stringify(v));
const TEKU = "teku.avado.dnp.dappnode.eth";
const ticketSnapshot = () => ({ diagnostics: clone(ticket0928.diagnostics), packages: ticket0928.packages });
const healthySnapshot = () => ({ diagnostics: clone(healthy.diagnostics), packages: healthy.packages });
// Plain language: no paths, commands or raw states in what the owner reads
const plain = f => {
  for (const text of [f.title, f.why, f.fix && f.fix.label, ...(f.steps || [])].filter(Boolean)) {
    expect(text).not.toMatch(/FATAL|supervisor|\/data|\/etc|docker|ECONNREFUSED/);
  }
};

describe("processDown", () => {
  it("Teku's container runs but its program is FATAL: critical, restart with one click", () => {
    const [f, ...rest] = processDown(ticketSnapshot());
    expect(rest).toEqual([]);
    expect(f).toMatchObject({
      id: `process-down:${TEKU}`,
      severity: "critical",
      appId: TEKU,
      title: "Teku Consensus Client is not running inside its container",
      fix: { kind: "action", action: "restartPackage", label: "Restart Teku Consensus Client" },
      secondary: { kind: "link", to: `/packages/${TEKU}?tab=logs` },
    });
    expect(f.why).toContain("your validators miss attestations");
    // The program and its last error stay for Advanced mode
    expect(f.detail).toContain("teku FATAL: Exited too quickly");
    expect(f.detail).toContain("Last error: FATAL - Exiting due to fatal error");
    plain(f);
  });

  it("an app that is not a chain client is a warning; a system app links to System", () => {
    const s = healthySnapshot();
    s.diagnostics.containers.push({ id: "mevboost.avado.dnp.dappnode.eth", isCore: false, state: "running", processes: [{ name: "mev-boost", state: "BACKOFF", description: "Exited too quickly" }] });
    s.diagnostics.containers.push({ id: "wifi.dnp.dappnode.eth", isCore: true, state: "running", processes: [{ name: "hostapd", state: "EXITED", description: "Oct 14 10:00 AM" }] });
    const [mev, wifi] = processDown(s);
    expect(mev.severity).toBe("warning");
    expect(mev.fix.action).toBe("restartPackage");
    expect(wifi).toMatchObject({ severity: "warning", topic: "core", fix: { kind: "link", to: "/system" } });
  });

  it("a validator the owner stopped from its page: no finding, so never a Restart (its keys may run elsewhere)", () => {
    const s = ticketSnapshot();
    s.diagnostics.containers[0].processes[0] = { name: "teku", state: "STOPPED", description: "Oct 14 10:36 AM" };
    expect(processDown(s)).toEqual([]);
    s.diagnostics.containers[0].processes[0] = { name: "teku", state: "UNKNOWN", description: "STOPPING Oct 14 10:36 AM" };
    expect(processDown(s)).toEqual([]);
    const all = runChecksDetailed(snapshot({ ...s }), ALL_RULES).findings;
    expect(all.filter(f => f.appId === TEKU && f.fix && f.fix.action === "restartPackage")).toEqual([]);
  });

  it("BACKOFF and EXITED count like FATAL", () => {
    for (const state of ["BACKOFF", "EXITED"]) {
      const s = ticketSnapshot();
      s.diagnostics.containers[0].processes[0].state = state;
      expect(processDown(s)).toHaveLength(1);
    }
  });

  it("the light variant (programs [] and log null) gives no process finding", () => {
    const s = ticketSnapshot();
    for (const c of s.diagnostics.containers) Object.assign(c, { processes: [], log: null, settings: null });
    expect(processDown(s)).toEqual([]);
    expect(appOomKilled(s)).toEqual([]);
    expect(appCrashLooping(s)).toEqual([]);
  });

  it("nothing on a healthy box, nor for a program never meant to start", () => {
    const s = healthySnapshot();
    s.diagnostics.containers[0].processes.push({ name: "qtum", state: "STOPPED", description: "Not started" });
    expect(processDown(s)).toEqual([]);
  });
});

describe("appOomKilled", () => {
  it("warns about an app stopped for lack of memory", () => {
    const s = healthySnapshot();
    s.diagnostics.containers[1].oomKilled = true;
    const [f] = appOomKilled(s);
    expect(f).toMatchObject({ id: "app-oom-killed:avado-dnp-nethermind.public.dappnode.eth", severity: "warning", title: "Nethermind Execution Client was stopped because your AVADO ran out of memory" });
    plain(f);
    expect(appOomKilled(healthySnapshot())).toEqual([]);
  });
});

describe("appCrashLooping", () => {
  const looping = () => {
    const s = healthySnapshot();
    Object.assign(s.diagnostics.containers[0], { restartCount: 4, uptimeSeconds: 600 });
    return s;
  };

  it("3 or more restarts and up for less than an hour", () => {
    const [f] = appCrashLooping(looping());
    expect(f).toMatchObject({ id: "app-crash-looping:nimbus.avado.dnp.dappnode.eth", severity: "critical", title: "Nimbus keeps restarting" });
    expect(f.why).toContain("4 times");
    plain(f);
  });

  it("not when up for over an hour, nor with fewer restarts", () => {
    const s = looping();
    s.diagnostics.containers[0].uptimeSeconds = 7200;
    expect(appCrashLooping(s)).toEqual([]);
    const t = looping();
    t.diagnostics.containers[0].restartCount = 2;
    expect(appCrashLooping(t)).toEqual([]);
  });

  it("leaves a restarting container to appRestarting and IPFS to ipfsRestarting", () => {
    const s = looping();
    s.diagnostics.containers[0].state = "restarting";
    expect(appCrashLooping(s)).toEqual([]);
    const i = healthySnapshot();
    Object.assign(i.diagnostics.containers.find(c => c.id === "ipfs.dnp.dappnode.eth"), { restartCount: 9, uptimeSeconds: 60 });
    expect(appCrashLooping({ ...i, ipfsHealth: { exists: true } })).toEqual([]);
    expect(appCrashLooping(i)).toHaveLength(1);
  });
});

describe("process rules in the engine", () => {
  it("are skipped (not counted) without diagnostics", () => {
    const rules = [processDown, appOomKilled, appCrashLooping];
    expect(runChecksDetailed(snapshot(), rules).total).toBe(0);
    expect(runChecksDetailed(snapshot({ diagnostics: clone(healthy.diagnostics) }), rules)).toMatchObject({ total: 3, passed: 3 });
    expect(ALL_RULES).toEqual(expect.arrayContaining(rules));
  });

  it("the ticket-0928 box gives the critical Teku finding", () => {
    const { findings } = runChecksDetailed(snapshot({ ...ticketSnapshot() }), ALL_RULES);
    expect(findings.map(f => f.id)).toContain(`process-down:${TEKU}`);
  });

  it("the call is used from DAPPMANAGER 10.0.53 on", () => {
    expect(DIAGNOSTICS_SINCE).toBe("10.0.53");
    const with_ = v => [{ name: "dappmanager.dnp.dappnode.eth", version: v }];
    expect(canGetDiagnostics(with_("10.0.52"))).toBe(false);
    expect(canGetDiagnostics(with_("10.0.53"))).toBe(true);
    expect(canGetDiagnostics(with_("10.1.0"))).toBe(true);
    expect(canGetDiagnostics([])).toBe(false);
  });
});
