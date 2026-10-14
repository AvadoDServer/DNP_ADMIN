import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { canGetDiagnostics } from "health/clients";
import { getDiagnostics, withTimeout, DIAGNOSTICS_TIMEOUT_MS } from "../diagnosticsApi";

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
 * The diagnostics report: what the app already knows plus, from a DAPPMANAGER
 * of 10.0.53 or newer, getDiagnostics (asked for on open and on Refresh,
 * every probe on, given up after 30 s). Shown to the user before it is copied
 * or sent. Only the Help home panel collects on open: the compact panel on
 * each Help topic waits for "Collect box details" (a full collection is a
 * privileged run and some 25 docker calls on the box). Never contains env
 * values or the public IP; logs and settings come
 * scrubbed of secrets — see `health/report.js`. "Email support" keeps its
 * short body (findings only) and asks for the downloaded report.
 */
export default function ReportPanel({
  compact = false,
  collectOnOpen = !compact,
  fetchDiagnosticsImpl = getDiagnostics,
  timeoutMs = DIAGNOSTICS_TIMEOUT_MS,
}) {
  const { allFindings, verdict, ready } = useHealth();
  const packages = useSelector(getDnpInstalled) || [];
  const stats = useSelector(getDappnodeStats) || {};
  const params = useSelector(getDappnodeParams) || {};
  const chainData = useSelector(getChainData) || [];
  const userActionLogs = useSelector(getUserActionLogs) || [];
  const dappmanagerVersionData = useSelector(getDappmanagerVersionData);
  const [showReport, setShowReport] = useState(false);
  // getDiagnostics: { status: "idle"|"loading"|"ok"|"error", data, error }
  const [diag, setDiag] = useState({ status: "idle", data: null, error: null });
  const allowed = canGetDiagnostics(packages);
  const run = useRef(0);
  const fetchRef = useRef(fetchDiagnosticsImpl);
  fetchRef.current = fetchDiagnosticsImpl;

  // `fresh`: the DAPPMANAGER keeps a full result for 20 s; Refresh (any
  // collection after the first) skips it, so an app just restarted shows its
  // new state. The first collection may use it.
  const collect = useCallback((fresh = false) => {
    const id = ++run.current;
    setDiag({ status: "loading", data: null, error: null });
    withTimeout(
      Promise.resolve().then(() => fetchRef.current(fresh ? { fresh: true } : {})),
      timeoutMs
    ).then(
      data => id === run.current && setDiag({ status: "ok", data: data && typeof data === "object" ? data : null, error: null }),
      e => id === run.current && setDiag({ status: "error", data: null, error: (e && e.message) || "unknown error" })
    );
  }, [timeoutMs]);

  useEffect(() => {
    // The run counter itself (not a DOM node): bumping it on close drops an
    // answer that arrives after the panel closed.
    const runs = run;
    if (allowed && collectOnOpen) collect();
    return () => {
      runs.current++;
    };
  }, [allowed, collectOnOpen, collect]);
  const loading = allowed && (diag.status === "loading" || (collectOnOpen && diag.status === "idle"));

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
    ready,
    diagnostics: diag.status === "ok" ? diag.data : null,
    diagnosticsError: diag.status === "error" ? diag.error : null,
    diagnosticsLoading: loading,
  });
  const mailto = mailtoReport(report, verdict, allFindings, ready);

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
          A plain-text summary of your AVADO for support: its health, apps, network and the last
          lines each app wrote. Passwords and keys are removed; it never includes your public IP.
        </p>
        {loading && (
          <p className="mb-0 text-sm text-fg-muted" role="status">
            Collecting box details…
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownload} disabled={loading}>
            Download report
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopy} disabled={loading}>
            Copy report
          </Button>
          <Button as="a" href={mailto} variant="primary" size="sm">
            Email support
          </Button>
          {allowed && (
            <Button variant="secondary" size="sm" onClick={() => collect(diag.status !== "idle")} disabled={loading}>
              {diag.status === "idle" ? "Collect box details" : "Refresh"}
            </Button>
          )}
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
