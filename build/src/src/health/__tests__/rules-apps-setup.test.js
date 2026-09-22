import { appStopped, appRestarting, coreAppDown } from "health/rules/apps";
import { consensusWithoutExecution, executionWithoutConsensus, monitoringMissing, metricsUnavailable } from "health/rules/setup";
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
});

describe("appRestarting", () => {
  it("flags a restarting app with a link to its logs", () => {
    const [f] = appRestarting(snapshot({ packages: [pkg(NIMBUS, { state: "restarting", running: true })] }));
    expect(f).toMatchObject({ severity: "critical", fix: { kind: "link", to: `/packages/${NIMBUS}?tab=logs` } });
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

describe("robustness", () => {
  it("rules tolerate manifest-less packages", () => {
    const s = snapshot({ packages: [{ name: "weird.public.dappnode.eth", state: "exited", running: false }] });
    for (const rule of [appStopped, appRestarting, coreAppDown, consensusWithoutExecution, executionWithoutConsensus, monitoringMissing])
      expect(() => rule(s)).not.toThrow();
    expect(appStopped(s)[0].title).toBe("weird is stopped");
  });
});
