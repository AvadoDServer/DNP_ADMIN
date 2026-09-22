import React, { useState } from "react";
import { useSelector } from "react-redux";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { useHealth } from "health/HealthProvider";
import { buildReport, mailtoReport } from "health/report";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import {
  getDappnodeStats,
  getDappnodeParams,
  getDappmanagerVersionData,
} from "services/dappnodeStatus/selectors";
import { getChainData } from "services/chainData/selectors";
import { getUserActionLogs } from "services/userActionLogs/selectors";

/** Admin + core versions, keyed for the report's "Versions" section. */
function buildVersions(packages, dappmanagerVersionData) {
  const versions = {
    admin: window.versionData && window.versionData.version,
    dappmanager: dappmanagerVersionData && dappmanagerVersionData.version,
  };
  for (const p of packages || []) {
    if (p && p.isCore && p.name) versions[p.name.split(".")[0]] = p.version;
  }
  return versions;
}

/**
 * The diagnostics report: built entirely from data already in the app (no
 * new DAPPMANAGER call). Shown to the user before it is copied or sent, and
 * deliberately never contains env values, keys, logs or a public IP — see
 * `health/report.js`.
 */
export default function ReportPanel({ compact = false }) {
  const { allFindings, verdict } = useHealth();
  const packages = useSelector(getDnpInstalled) || [];
  const stats = useSelector(getDappnodeStats) || {};
  const params = useSelector(getDappnodeParams) || {};
  const chainData = useSelector(getChainData) || [];
  const userActionLogs = useSelector(getUserActionLogs) || [];
  const dappmanagerVersionData = useSelector(getDappmanagerVersionData);
  const [showReport, setShowReport] = useState(false);

  const versions = buildVersions(packages, dappmanagerVersionData);
  const report = buildReport({
    verdict,
    findings: allFindings,
    packages,
    stats,
    params,
    chainData,
    userActionLogs,
    versions,
    now: new Date(),
  });
  const mailto = mailtoReport(report, verdict, allFindings);

  function handleDownload() {
    saveAs(new Blob([report], { type: "text/plain" }), "avado-report.txt");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(report);
      toast("Report copied");
    } catch (e) {
      toast("Could not copy the report. Try downloading it instead.");
    }
  }

  return (
    <section className={compact ? undefined : "mt-8"}>
      {!compact && <h2 className="mb-3 text-sm font-semibold text-fg-muted">Diagnostics report</h2>}
      <Card padding={compact ? "md" : "lg"} className="flex flex-col gap-3">
        <p className="mb-0 text-sm text-fg-muted">
          A plain-text summary of your AVADO's health, versions, apps and recent activity, for
          support. It never includes environment values, keys, logs or your public IP.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            Download report
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            Copy report
          </Button>
          <Button as="a" href={mailto} variant="primary" size="sm">
            Email support
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowReport(o => !o)}
          aria-expanded={showReport}
          className="self-start text-sm text-fg-muted hover:text-fg"
        >
          {showReport ? "Hide what's in it" : "Show what's in it"}
        </button>
        {showReport && (
          <pre className="max-h-80 overflow-auto rounded-md border border-border bg-bg-subtle p-3 font-mono text-xs text-fg-muted">
            {report}
          </pre>
        )}
      </Card>
    </section>
  );
}
