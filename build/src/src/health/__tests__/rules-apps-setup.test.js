import { appStopped, appRestarting, coreAppDown } from "health/rules/apps";
import { consensusWithoutExecution, executionWithoutConsensus, monitoringMissing, metricsUnavailable, monitoringStopped } from "health/rules/setup";
import { PROMETHEUS_PACKAGE } from "health/clients";
import { pkg, snapshot } from "./fixtures";

const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
const GETH = "ethchain-geth.public.dappnode.eth";
const NETHERMIND = "avado-dnp-nethermind.public.dappnode.eth";

describe("appStopped", () => {
  it("flags an exited client as critical with a start action", () => {
    const s = snapshot({ packages: [pkg(NIMBUS, { state: "exited", running: false, manifest: { title: "Nimbus Consensus Client" } })] });
    const [f] = appStopped(s);
    expect(f).toMatchObject({ id: `app-stopped:${NIMBUS}`, severity: "critical", topic: "sync", appId: NIMBUS });
    expect(f.title).toBe("Nimbus Consensus Client is stopped");
    expect(f.fix).toMatchObject({ kind: "action", action: "restartPackage", label: "Start it" });
  });
  it("is a warning for non-client apps and ignores core and running apps", () => {
    const s = snapshot({ packages: [
      pkg("rotki.avado.dnp.dappnode.eth", { state: "exited", running: false }),
      pkg("ipfs.dnp.dappnode.eth", { state: "exited", running: false, isCore: true }),
      pkg(GETH),
    ] });
    const out = appStopped(s);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
  });
  it("does not flag a package that is merely created (not yet started after install)", () => {
    const s = snapshot({ packages: [pkg("rotki.avado.dnp.dappnode.eth", { state: "created", running: false })] });
    expect(appStopped(s)).toEqual([]);
  });
  it("no one-click start for a validator app while another one runs for the same network", () => {
    const TEKU = "teku.avado.dnp.dappnode.eth";
    const stoppedTeku = pkg(TEKU, { state: "exited", running: false, manifest: { title: "Teku" } });
    const [f] = appStopped(snapshot({ packages: [pkg(NIMBUS, { manifest: { title: "Nimbus" } }), stoppedTeku] }));
    // Its validators may have moved to Nimbus: starting Teku could sign twice.
    // Still critical: Nimbus may hold none of Teku's keys (split keys, or an
    // app with none left), and AVADO Care emails only critical findings.
    expect(f).toMatchObject({ id: `app-stopped:${TEKU}`, severity: "critical", appId: TEKU, title: "Teku is stopped" });
    expect(f.fix).toEqual({ kind: "link", to: `/packages/${TEKU}`, label: "Open the app" });
    expect(f.why).toMatch(/Start it only if they were not moved to Nimbus/);
    // Never tells the owner to remove it: it may be the app with the keys.
    expect(f.why).not.toMatch(/remove/i);
    const lighthouse = pkg("lighthouse.avado.dnp.dappnode.eth", { manifest: { title: "Lighthouse" } });
    const [both] = appStopped(snapshot({ packages: [pkg(NIMBUS, { manifest: { title: "Nimbus" } }), lighthouse, stoppedTeku] }));
    expect(both.why).toMatch(/not moved to Nimbus and Lighthouse:/);
    // Prysm's beacon chain holds no keys, another network does not count, and
    // with both validator apps stopped the usual start action stays.
    for (const other of [pkg("prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth"), pkg("teku-holesky.avado.dnp.dappnode.eth"), pkg(NIMBUS, { state: "exited", running: false })]) {
      const out = appStopped(snapshot({ packages: [other, stoppedTeku] })).find(x => x.appId === TEKU);
      expect(out).toMatchObject({ severity: "critical", fix: { kind: "action", action: "restartPackage" } });
    }
    // An execution client keeps its start action next to a running Nimbus.
    const [geth] = appStopped(snapshot({ packages: [pkg(NIMBUS), pkg(GETH, { state: "exited", running: false })] }));
    expect(geth).toMatchObject({ severity: "critical", fix: { kind: "action" } });
  });
  it("skips a stopped Prometheus package — monitoringStopped covers it instead", () => {
    const s = snapshot({ packages: [pkg(PROMETHEUS_PACKAGE, { state: "exited", running: false })] });
    expect(appStopped(s)).toEqual([]);
  });
});

describe("appRestarting", () => {
  it("flags a restarting app with a link to its logs", () => {
    const [f] = appRestarting(snapshot({ packages: [pkg(NIMBUS, { state: "restarting", running: true })] }));
    expect(f).toMatchObject({ severity: "critical", fix: { kind: "link", to: `/packages/${NIMBUS}?tab=logs` } });
  });
  it("tells Simple-mode owners how to reach the Settings tab (hidden in Simple)", () => {
    const [f] = appRestarting(snapshot({ packages: [pkg(NIMBUS, { state: "restarting", running: true })] }));
    const step = f.steps.find(s => s.includes("Settings tab"));
    expect(step).toMatch(/Advanced mode/);
  });
});

describe("coreAppDown", () => {
  it("flags installed core packages that are not running", () => {
    const [f] = coreAppDown(snapshot({ packages: [pkg("ipfs.dnp.dappnode.eth", { isCore: true, state: "exited", running: false })] }));
    expect(f).toMatchObject({ severity: "critical", topic: "core", fix: { kind: "link", to: "/system" } });
  });
});

describe("setup pairing", () => {
  it("flags a consensus client without an execution client on the same network", () => {
    const [f] = consensusWithoutExecution(snapshot({ packages: [pkg(NIMBUS)] }));
    expect(f).toMatchObject({ id: "consensus-without-execution:mainnet", severity: "critical", topic: "setup", appId: NIMBUS });
    expect(f.fix).toMatchObject({ kind: "link", to: "/installer?category=ethstaking" });
    // The docs page that walks through installing one, not the docs home page.
    expect(f.learnMore).toBe("https://docs.ava.do/staking-ethereum/setting-up-the-eth-clients");
  });
  it("is quiet when both halves are installed", () => {
    const s = snapshot({ packages: [pkg(NIMBUS), pkg(GETH)] });
    expect(consensusWithoutExecution(s)).toEqual([]);
    expect(executionWithoutConsensus(s)).toEqual([]);
  });
  it("warns about an execution client with no consensus client", () => {
    const [f] = executionWithoutConsensus(snapshot({ packages: [pkg(GETH)] }));
    expect(f).toMatchObject({ severity: "warning", topic: "setup" });
  });
  it("emits one finding per network even with two execution clients and no consensus client", () => {
    const out = executionWithoutConsensus(snapshot({ packages: [pkg(GETH), pkg(NETHERMIND)] }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("execution-without-consensus:mainnet");
  });
  it("suggests monitoring when a consensus client runs without Prometheus", () => {
    expect(monitoringMissing(snapshot({ packages: [pkg(NIMBUS)] }))).toMatchObject({ id: "monitoring-missing", severity: "info", topic: "attestations" });
    expect(monitoringMissing(snapshot({ packages: [pkg(NIMBUS), pkg("prometheus.avado.dappnode.eth")] }))).toBeNull();
  });
});

describe("metricsUnavailable", () => {
  it("flags an info finding when the last Prometheus scrape failed", () => {
    const f = metricsUnavailable(snapshot({ sources: { updates: "ok", metrics: "failed" } }));
    expect(f).toMatchObject({ id: "metrics-unavailable", severity: "info", topic: "attestations" });
    expect(f.why).toMatch(/Remote Connect/);
    expect(f.fix).toMatchObject({ kind: "steps" });
    expect(f.steps.length).toBeGreaterThan(0);
  });

  it("is quiet when metrics are not installed or reachable", () => {
    expect(metricsUnavailable(snapshot({ sources: { updates: "ok", metrics: "not-installed" } }))).toBeNull();
    expect(metricsUnavailable(snapshot({ sources: { updates: "ok", metrics: "ok" } }))).toBeNull();
    expect(metricsUnavailable(snapshot({ sources: undefined }))).toBeNull();
  });
});

describe("monitoringStopped", () => {
  it("flags a warning when Prometheus is installed but not running", () => {
    const f = monitoringStopped(snapshot({ packages: [pkg(PROMETHEUS_PACKAGE, { state: "exited", running: false })] }));
    expect(f).toMatchObject({
      id: "monitoring-stopped",
      severity: "warning",
      topic: "attestations",
      appId: PROMETHEUS_PACKAGE,
      title: "Monitoring has stopped",
    });
    expect(f.fix).toMatchObject({ kind: "action", action: "restartPackage", label: "Restart monitoring" });
  });

  it("is quiet when Prometheus is not installed, or is installed and running", () => {
    expect(monitoringStopped(snapshot({ packages: [] }))).toBeNull();
    expect(monitoringStopped(snapshot({ packages: [pkg(PROMETHEUS_PACKAGE)] }))).toBeNull();
  });

  it("produces exactly one finding for a stopped Prometheus — no duplicate app-stopped finding", () => {
    const s = snapshot({ packages: [pkg(PROMETHEUS_PACKAGE, { state: "exited", running: false })] });
    const monitoring = monitoringStopped(s);
    const all = [...appStopped(s), ...(monitoring ? [monitoring] : [])];
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("monitoring-stopped");
    expect(all.some(f => f.id === `app-stopped:${PROMETHEUS_PACKAGE}`)).toBe(false);
  });
});

describe("robustness", () => {
  it("rules tolerate manifest-less packages", () => {
    const s = snapshot({ packages: [{ name: "weird.public.dappnode.eth", state: "exited", running: false }] });
    for (const rule of [appStopped, appRestarting, coreAppDown, consensusWithoutExecution, executionWithoutConsensus, monitoringMissing, monitoringStopped])
      expect(() => rule(s)).not.toThrow();
    expect(appStopped(s)[0].title).toBe("weird is stopped");
  });
});

describe("Lighthouse", () => {
  const LIGHTHOUSE = "lighthouse.avado.dnp.dappnode.eth";
  it("a stopped Lighthouse is critical, like the other consensus clients", () => {
    const [f] = appStopped(snapshot({ packages: [pkg(LIGHTHOUSE, { state: "exited", running: false })] }));
    expect(f).toMatchObject({ id: `app-stopped:${LIGHTHOUSE}`, severity: "critical" });
  });
  it("pairs with an execution client, so Geth + Lighthouse is a complete setup", () => {
    const s = snapshot({ packages: [pkg(GETH), pkg(LIGHTHOUSE)] });
    expect(executionWithoutConsensus(s)).toEqual([]);
    expect(consensusWithoutExecution(s)).toEqual([]);
    const alone = consensusWithoutExecution(snapshot({ packages: [pkg(LIGHTHOUSE)] }));
    expect(alone).toMatchObject([{ id: "consensus-without-execution:mainnet", severity: "critical", appId: LIGHTHOUSE }]);
  });
});
