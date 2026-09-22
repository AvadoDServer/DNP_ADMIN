import React, { useState } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import * as a from "../actions";
import { DISK_CLEANUP } from "../signedCommands";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappnodeStats } from "services/dappnodeStatus/selectors";
import { appDiskUse } from "health/rules/storage";
import { appTitle } from "health/rules/apps";
import { getClient } from "health/clients";
import humanFileSize from "utils/humanFileSize";
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
        <span className="flex-shrink-0 font-mono text-xs text-fg-subtle">{humanFileSize(size)}</span>
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

function SystemStorage({ dnpInstalled, dappnodeStats, runSignedCmd }) {
  const rows = storageRows(dnpInstalled);
  const pct = parseInt((dappnodeStats && dappnodeStats.disk) || "0", 10) || 0;
  const status = pct > 90 ? "danger" : pct > 75 ? "warning" : "accent";

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
          <span className="text-sm font-semibold text-fg">{pct}% used</span>
        </div>
        <ProgressBar value={pct} variant={status} className="mt-3" />
        {dappnodeStats && dappnodeStats.diskUsed && dappnodeStats.diskTotal && (
          <div className="mt-2 flex items-center justify-between text-xs text-fg-subtle">
            <span>{dappnodeStats.diskUsed} used</span>
            <span>{dappnodeStats.diskTotal} total</span>
          </div>
        )}
      </Card>

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
});

const mapDispatchToProps = {
  runSignedCmd: a.runSignedCmd,
};

export default connect(mapStateToProps, mapDispatchToProps)(SystemStorage);
export { SystemStorage };
