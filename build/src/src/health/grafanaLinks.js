// Links into the client dashboards of the AVADO Grafana package
// (AVADO-DNP-Grafana build/dashboards/*.json). Admin only: AVADO Care does
// not vendor this file, so it may use semver and stays out of clients.js and
// the rules, which Care copies byte for byte.
//
// A link is only offered when it can open a working chart:
//  - Grafana 0.0.3 or newer is installed and running. The dashboards, their
//    Prometheus datasource and anonymous viewing arrived in 0.0.3; on 0.0.2
//    /d/avado-* is "Dashboard not found".
//  - Prometheus is running (without it every chart is empty).
//  - The client has a dashboard: Nimbus, Teku and Prysm. Lighthouse has none.
// No hostname check, same as the Grafana app tile: if the Admin reaches
// wamp.my.ava.do, grafana.my.ava.do resolves too.
import semver from "semver";
import { getClient, GRAFANA_PACKAGE, PROMETHEUS_PACKAGE } from "./clients";

export const GRAFANA_URL = "http://grafana.my.ava.do:3000";
export const GRAFANA_DASHBOARDS_SINCE = "0.0.3";

// Dashboard paths by Prometheus client label. `short` is the package name's
// first part (nimbus-holesky, teku-gnosis, ...), which AVADO-DNP-Prometheus
// scrapes as the `instance` <short>.my.ava.do:8008.
const DASHBOARDS = {
  // Its `instance` list has no default and sorts "nimbus-holesky…" before
  // "nimbus.…", so always pick this app's instance.
  nimbus: short => `/d/avado-nimbus?var-instance=${short}.my.ava.do:8008`,
  // `system` can select several instances (and "All"): pick this one only,
  // or the charts mix networks.
  teku: short => `/d/avado-teku?var-system=${short}.my.ava.do:8008`,
  // Fixed to the prysm-beacon and prysm-validator jobs, no variables.
  prysm: () => "/d/avado-prysm",
};

// Findings whose problem shows on the client's chart.
const CHART_FINDINGS = ["head-behind:", "low-peers:", "missed-attestations:"];

const running = (packages, name) => (packages || []).some(p => p && p.name === name && p.running);

export function grafanaReady(packages) {
  const grafana = (packages || []).find(p => p && p.name === GRAFANA_PACKAGE);
  return Boolean(
    grafana &&
      grafana.running &&
      semver.valid(grafana.version) &&
      semver.gte(grafana.version, GRAFANA_DASHBOARDS_SINCE) &&
      running(packages, PROMETHEUS_PACKAGE)
  );
}

/** The Grafana dashboard of an installed client, or null when there is none to open. */
export function chartUrl(pkgName, packages) {
  const client = getClient(pkgName);
  const dashboard = client && DASHBOARDS[client.promClient];
  if (!dashboard || !grafanaReady(packages)) return null;
  return GRAFANA_URL + dashboard(pkgName.split(".")[0]);
}

/** The chart for a head-behind, low-peers or missed-attestations finding, else null. */
export function findingChartUrl(finding, packages) {
  if (!finding || !finding.appId || !CHART_FINDINGS.some(prefix => String(finding.id).startsWith(prefix))) return null;
  return chartUrl(finding.appId, packages);
}
