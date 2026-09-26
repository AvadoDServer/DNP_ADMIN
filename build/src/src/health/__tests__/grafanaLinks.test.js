import { chartUrl, findingChartUrl, grafanaReady, GRAFANA_URL } from "health/grafanaLinks";
import { pkg } from "health/__tests__/fixtures";

const GRAFANA = "grafana.avado.dappnode.eth";
const PROMETHEUS = "prometheus.avado.dappnode.eth";
const NIMBUS = "nimbus.avado.dnp.dappnode.eth";

// Grafana 0.0.5 (on staging) and Prometheus, both running, plus the given apps.
const withMonitoring = (grafana = {}, prometheus = {}, ...apps) => [
  pkg(GRAFANA, { version: "0.0.5", ...grafana }),
  pkg(PROMETHEUS, { version: "0.0.2", ...prometheus }),
  ...apps,
];

describe("grafanaReady", () => {
  it("is true once Grafana 0.0.3 or newer and Prometheus both run", () => {
    expect(grafanaReady(withMonitoring())).toBe(true);
    expect(grafanaReady(withMonitoring({ version: "0.0.3" }))).toBe(true);
  });

  it("is false without Grafana, with Grafana stopped, or with Grafana older than 0.0.3 (no dashboards yet)", () => {
    expect(grafanaReady([pkg(PROMETHEUS)])).toBe(false);
    expect(grafanaReady(withMonitoring({ running: false, state: "exited" }))).toBe(false);
    expect(grafanaReady(withMonitoring({ version: "0.0.2" }))).toBe(false);
    expect(grafanaReady(withMonitoring({ version: "0.0.3-beta.1" }))).toBe(false);
    // A version that isn't semver (e.g. an IPFS hash) can't be shown to have the dashboards.
    expect(grafanaReady(withMonitoring({ version: "/ipfs/QmRaQB7DDo1kbJS9McwMv7j1gqVok7QqkwpmwNqUZVj1B3" }))).toBe(false);
  });

  it("is false while Prometheus is stopped or missing: every chart would be empty", () => {
    expect(grafanaReady(withMonitoring({}, { running: false, state: "exited" }))).toBe(false);
    expect(grafanaReady([pkg(GRAFANA, { version: "0.0.5" })])).toBe(false);
    expect(grafanaReady(undefined)).toBe(false);
  });
});

describe("chartUrl", () => {
  const packages = withMonitoring();

  it("opens the Nimbus dashboard with this app's instance selected", () => {
    expect(chartUrl(NIMBUS, packages)).toBe("http://grafana.my.ava.do:3000/d/avado-nimbus?var-instance=nimbus.my.ava.do:8008");
    // "nimbus-holesky…" sorts first in the dropdown, so each network names its own instance.
    expect(chartUrl("nimbus-holesky.avado.dnp.dappnode.eth", packages)).toBe(
      "http://grafana.my.ava.do:3000/d/avado-nimbus?var-instance=nimbus-holesky.my.ava.do:8008"
    );
  });

  it("opens the Teku dashboard with only this app's system selected", () => {
    expect(chartUrl("teku.avado.dnp.dappnode.eth", packages)).toBe("http://grafana.my.ava.do:3000/d/avado-teku?var-system=teku.my.ava.do:8008");
    expect(chartUrl("teku-gnosis.avado.dnp.dappnode.eth", packages)).toBe(
      "http://grafana.my.ava.do:3000/d/avado-teku?var-system=teku-gnosis.my.ava.do:8008"
    );
  });

  it("opens the Prysm dashboard for the beacon chain and the validator app", () => {
    expect(chartUrl("prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth", packages)).toBe(`${GRAFANA_URL}/d/avado-prysm`);
    expect(chartUrl("eth2validator.avado.dnp.dappnode.eth", packages)).toBe(`${GRAFANA_URL}/d/avado-prysm`);
  });

  it("has nothing for Lighthouse (no dashboard), other apps or unknown packages", () => {
    expect(chartUrl("lighthouse.avado.dnp.dappnode.eth", packages)).toBeNull();
    expect(chartUrl("ethchain-geth.public.dappnode.eth", packages)).toBeNull();
    expect(chartUrl(GRAFANA, packages)).toBeNull();
    expect(chartUrl("someone-else.dnp.dappnode.eth", packages)).toBeNull();
    expect(chartUrl(undefined, packages)).toBeNull();
  });

  it("has nothing until Grafana can open it: not installed, stopped, 0.0.2, or Prometheus stopped", () => {
    expect(chartUrl(NIMBUS, [pkg(PROMETHEUS), pkg(NIMBUS)])).toBeNull();
    expect(chartUrl(NIMBUS, withMonitoring({ running: false, state: "exited" }))).toBeNull();
    expect(chartUrl(NIMBUS, withMonitoring({ version: "0.0.2" }))).toBeNull();
    expect(chartUrl(NIMBUS, withMonitoring({}, { running: false, state: "exited" }))).toBeNull();
  });
});

describe("findingChartUrl", () => {
  const packages = withMonitoring();
  const finding = (id, appId = NIMBUS) => ({ id: `${id}:${appId}`, appId, severity: "warning", title: "t" });

  it("links falling behind, few peers and missed attestations to the app's chart", () => {
    const nimbus = "http://grafana.my.ava.do:3000/d/avado-nimbus?var-instance=nimbus.my.ava.do:8008";
    expect(findingChartUrl(finding("head-behind"), packages)).toBe(nimbus);
    expect(findingChartUrl(finding("low-peers"), packages)).toBe(nimbus);
    expect(findingChartUrl(finding("missed-attestations"), packages)).toBe(nimbus);
  });

  it("leaves every other finding alone, even one about the same app", () => {
    expect(findingChartUrl(finding("app-restarting"), packages)).toBeNull();
    expect(findingChartUrl(finding("chain-error"), packages)).toBeNull();
    expect(findingChartUrl({ id: "head-behind:x", severity: "warning" }, packages)).toBeNull();
    expect(findingChartUrl(null, packages)).toBeNull();
  });

  it("has nothing for a Lighthouse finding or without Grafana", () => {
    expect(findingChartUrl(finding("low-peers", "lighthouse.avado.dnp.dappnode.eth"), packages)).toBeNull();
    expect(findingChartUrl(finding("low-peers"), [pkg(NIMBUS)])).toBeNull();
  });
});
