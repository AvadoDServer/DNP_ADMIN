import React, { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { createStructuredSelector } from "reselect";
import * as a from "../actions";
import { DISK_CLEANUP } from "../signedCommands";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappnodeParams, getDappnodeStats } from "services/dappnodeStatus/selectors";
import {
  appDiskUse,
  atLeast,
  formatDockerSize,
  formatDiskSize,
  inAbout,
  parsePercent,
  testNetworkHint,
  FORECAST_MIN_HOURS,
  FORECAST_WARN_DAYS,
} from "health/rules/storage";
import { appTitle } from "health/rules/apps";
import { getClient, GRAFANA_PACKAGE, NODE_EXPORTER_PACKAGE, PROMETHEUS_PACKAGE, ROCKET_POOL_PACKAGE } from "health/clients";
import { KIT_PRICE, KIT_URL, showKitOffer } from "health/diskUpgrade";
import { useHealth } from "health/HealthProvider";
import { useMode } from "settings/ModeProvider";
import { rootPath as priorityPath, PRIORITY_CARE_EMAIL } from "pages/priority/data";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import ProgressBar from "components/ui/ProgressBar";
import AppAvatar from "components/ui/AppAvatar";
import { SectionHeader } from "components/ui/PageHeader";
import { confirmSignedCmd } from "./SystemPresentation";

/**
 * Sorts installed packages by disk use (sum of `volumes[].size`, the same
 * field `health/rules/storage.js` reads) and computes each one's share of the
 * total. Packages using no disk space at all are left out.
 */
export function storageRows(packages) {
  const sized = (packages || [])
    .map(pkg => ({ pkg, size: appDiskUse(pkg) }))
    .filter(({ size }) => size > 0);
  const total = sized.reduce((sum, { size }) => sum + size, 0);
  return sized
    .sort((a, b) => b.size - a.size)
    .map(({ pkg, size }) => ({ pkg, size, share: total ? size / total : 0 }));
}

function StorageRow({ pkg, size, share }) {
  const [adviceOpen, setAdviceOpen] = useState(false);
  const client = getClient(pkg.name);
  const advice = client && client.pruneAdvice;

  return (
    <li className="flex flex-col gap-2 py-3.5">
      <div className="flex items-center gap-3">
        <AppAvatar pkg={pkg} size={28} />
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-medium text-fg">{appTitle(pkg)}</div>
          <ProgressBar value={share * 100} size="sm" className="mt-1.5" />
        </div>
        <span className="flex-shrink-0 font-mono text-xs text-fg-subtle">{formatDockerSize(size)}</span>
      </div>
      {advice && (
        <button
          type="button"
          onClick={() => setAdviceOpen(o => !o)}
          className="self-start pl-[2.75rem] text-left text-xs text-fg-muted hover:text-fg"
          aria-expanded={adviceOpen}
        >
          {adviceOpen ? advice : "How to free up this app's space"}
        </button>
      )}
    </li>
  );
}

// The forecast needs Prometheus and node-exporter; installing monitoring
// (Grafana) brings both.
export const MONITORING_INSTALL_PATH = `/installer/${GRAFANA_PACKAGE}`;
const monitoringInstalled = packages =>
  [PROMETHEUS_PACKAGE, NODE_EXPORTER_PACKAGE].every(name => (packages || []).some(p => p && p.name === name));

/**
 * One line under the disk bar: when the disk is full at the pace it has
 * been filling up (health/rules/storage.js diskForecast), or why there is no
 * forecast. Plain words in both modes; Advanced adds the daily amount.
 */
export function DiskForecast({ forecast, status, hasMonitoring, isAdvanced }) {
  const line = (text, tone = "text-fg-muted") => <p className={`mb-0 mt-3 text-sm ${tone}`}>{text}</p>;
  if (!hasMonitoring) {
    return line(
      <Link to={MONITORING_INSTALL_PATH} className="font-medium text-accent hover:underline">
        Install monitoring to see a forecast
      </Link>
    );
  }
  if (status === "loading") return null;
  const f = forecast || { state: "none" };
  const free = typeof f.free === "number" ? ` · ${formatDiskSize(f.free)} free` : "";
  if (f.state === "filling" && f.days <= 365) {
    const daily = isAdvanced ? ` · about ${formatDiskSize(f.bytesPerDay)} a day` : "";
    return line(
      `At this rate your disk is full ${inAbout(f.days)}${free}${daily}`,
      f.days < FORECAST_WARN_DAYS ? "font-medium text-warning-text" : "text-fg-muted"
    );
  }
  if (f.state === "filling" || f.state === "stable") return line(`At this rate your disk has room for more than a year${free}`);
  if (f.state === "roomy") return line(`At this rate your disk has room for ${atLeast(f.days)}${free}`);
  if (f.state === "full") return line(`Your disk is full${free}`, "font-medium text-danger-text");
  if (f.state === "collecting") {
    // Under 2 days of data; or 2 days and more, but a date under 60 days needs a week.
    const wait = f.hours >= FORECAST_MIN_HOURS ? "a week" : "2 days";
    return line(`A forecast of when your disk is full shows after ${wait} of monitoring.`);
  }
  if (f.state === "syncing") return line("No forecast while a client is syncing: syncing fills the disk much faster than usual.");
  if (f.state === "unsettled") return line("Your disk use changed a lot recently, so there is no forecast until it settles.");
  return line("No forecast right now: your monitoring isn't answering.");
}

/**
 * "Email us" on the kit card: the Priority Care discount and guided move go
 * through the Priority Care team (the shop itself sells at the full price).
 * The node id, when known, is what the team looks the membership up by.
 */
export function kitMemberMailto(nodeId) {
  const subject = "4 TB upgrade kit (Priority Care)";
  const body = [
    "Hi AVADO team,",
    "",
    "I am a Priority Care member and would like the 4 TB upgrade kit, with the member discount and a guided move to the new disk.",
    ...(typeof nodeId === "string" && nodeId ? ["", `Node ID: ${nodeId}`] : []),
  ].join("\n");
  return `mailto:${PRIORITY_CARE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * The 4 TB upgrade kit (health/diskUpgrade.js decides when it shows). It
 * names the free space to win back first (test-network apps), says plainly
 * what the move involves before linking to the shop, sends Rocket Pool
 * owners to support first (their keys live in the Rocket Pool wallet, as in
 * the double-signing guard's steps), and tells Priority Care members how to
 * claim their discount and guided move.
 */
export const DiskUpgradeCard = React.forwardRef(function DiskUpgradeCard({ spaceHint = "", rocketPool = false, nodeId } = {}, ref) {
  return (
    <Card ref={ref} padding="lg" className="mt-4" aria-labelledby="disk-upgrade-title">
      <h2 id="disk-upgrade-title" className="mb-0 text-base font-semibold text-fg">
        Need more space? Upgrade to 4 TB
      </h2>
      {spaceHint && <p className="mb-0 mt-2 text-sm text-fg">Before you buy, free what you can. {spaceHint}</p>}
      <p className="mb-0 mt-2 text-sm text-fg-muted">
        The 4 TB upgrade kit replaces your 2 TB disk with one twice the size. It costs {KIT_PRICE}.
      </p>
      <p className="mb-0 mt-2 text-sm text-fg-muted">
        A new disk means setting up your AVADO again. Back up your validator keys first. Your clients then download
        the chain again, which can take a few days, and your validators are offline until that is done.
      </p>
      {rocketPool && (
        <p className="mb-0 mt-2 text-sm font-medium text-fg">
          If you run Rocket Pool, contact AVADO support before you start: your Rocket Pool wallet has to move to the
          new disk too.
        </p>
      )}
      <p className="mb-0 mt-2 text-sm text-fg-muted">
        Priority Care member?{" "}
        <a href={kitMemberMailto(nodeId)} className="font-medium text-accent hover:underline">
          Email us
        </a>{" "}
        before you order. You get 10% off, and we guide you through the move.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button as="a" href={KIT_URL} target="_blank" rel="noopener noreferrer" size="sm">
          See the 4 TB kit
        </Button>
        <Button as={Link} to={priorityPath} size="sm" variant="ghost">
          About Priority Care
        </Button>
      </div>
    </Card>
  );
});

function SystemStorage({ dnpInstalled, dappnodeStats, dappnodeParams, runSignedCmd }) {
  const rows = storageRows(dnpInstalled);
  // Same parser and 80/90 thresholds as Home's Resources strip, so the two
  // pages never disagree about how full the disk is.
  const pct = parsePercent(dappnodeStats && dappnodeStats.disk) || 0;
  const status = pct >= 90 ? "danger" : pct >= 80 ? "warning" : "accent";
  const { diskForecast, diskTrendStatus } = useHealth();
  const { isAdvanced } = useMode();
  const showKit = showKitOffer(dappnodeStats, diskForecast);
  // "Get more space" on a disk finding links here with ?kit=1: bring the card into view.
  const location = useLocation();
  const kitRequested = new URLSearchParams(location.search).has("kit");
  const kitRef = useRef(null);
  useEffect(() => {
    const el = kitRef.current;
    if (kitRequested && el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [kitRequested, showKit]);

  const cleanUp = () =>
    confirmSignedCmd(
      DISK_CLEANUP,
      {
        title: "Clean up disk",
        text: "Are you sure you want to perform a disk cleanup?",
      },
      runSignedCmd,
      "Disk cleanup"
    );

  return (
    <div className="animate-fade-in">
      <Card padding="lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-fg">Disk</span>
          <span className="text-sm font-semibold text-fg">{Math.round(pct)}% used</span>
        </div>
        <ProgressBar value={pct} variant={status} className="mt-3" />
        {dappnodeStats && dappnodeStats.diskUsed && dappnodeStats.diskTotal && (
          <div className="mt-2 flex items-center justify-between text-xs text-fg-subtle">
            <span>{dappnodeStats.diskUsed} used</span>
            <span>{dappnodeStats.diskTotal} total</span>
          </div>
        )}
        <DiskForecast
          forecast={diskForecast}
          status={diskTrendStatus}
          hasMonitoring={monitoringInstalled(dnpInstalled)}
          isAdvanced={isAdvanced}
        />
      </Card>

      {showKit && (
        <DiskUpgradeCard
          ref={kitRef}
          spaceHint={testNetworkHint(dnpInstalled)}
          rocketPool={(dnpInstalled || []).some(p => p && p.name === ROCKET_POOL_PACKAGE)}
          nodeId={dappnodeParams && dappnodeParams.nodeid}
        />
      )}

      <SectionHeader
        title="Apps"
        count={rows.length}
        action={
          <Button variant="secondary" size="sm" onClick={cleanUp}>
            Clean up unused images
          </Button>
        }
      />
      <Card padding="none">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">No app is using disk space yet.</p>
        ) : (
          <ul className="divide-y divide-border px-4">
            {rows.map(row => (
              <StorageRow key={row.pkg.name} {...row} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  dnpInstalled: getDnpInstalled,
  dappnodeStats: getDappnodeStats,
  dappnodeParams: getDappnodeParams,
});

const mapDispatchToProps = {
  runSignedCmd: a.runSignedCmd,
};

export default connect(mapStateToProps, mapDispatchToProps)(SystemStorage);
export { SystemStorage };
