import React, { useMemo, useState } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { getUserActionLogs } from "services/userActionLogs/selectors";
import { shortNameCapitalized } from "utils/format";
// UI kit
import Card from "components/ui/Card";
import { Select } from "components/ui/Input";
import { cn } from "components/ui/cn";

const LEVEL_TONE = { error: "bg-danger", warn: "bg-warning", info: "bg-success" };

/**
 * "restartPackage.dappmanager.dnp.dappnode.eth" -> "Restart package".
 * Drops everything after the first "." (the DNP name kwargs.id already
 * carries) and turns the camelCase method name into words.
 */
export function humaniseEvent(event) {
  const key = ((event || "").split(".")[0] || "").trim();
  if (!key) return "";
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function HistoryRow({ log }) {
  const appId = log.kwargs && log.kwargs.id;
  return (
    <li className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex items-center gap-2 sm:w-44 sm:flex-shrink-0">
        <span
          className={cn("h-2 w-2 flex-shrink-0 rounded-full", LEVEL_TONE[log.level] || "bg-fg/25")}
          aria-hidden="true"
        />
        <span className="text-xs text-fg-subtle">{new Date(log.timestamp).toLocaleString()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="break-words font-medium text-fg">{humaniseEvent(log.event)}</span>
          {appId && <span className="text-xs font-medium text-fg-subtle">{shortNameCapitalized(appId)}</span>}
        </div>
        {log.message && <p className="mb-0 mt-0.5 break-words text-sm text-fg-muted">{log.message}</p>}
      </div>
    </li>
  );
}

function SystemHistory({ userActionLogs }) {
  const [appFilter, setAppFilter] = useState("");
  const logs = userActionLogs || [];

  const apps = useMemo(() => {
    const seen = new Set();
    (userActionLogs || []).forEach(log => {
      const id = log.kwargs && log.kwargs.id;
      if (id) seen.add(id);
    });
    return Array.from(seen).sort();
  }, [userActionLogs]);

  const rows = appFilter ? logs.filter(log => (log.kwargs && log.kwargs.id) === appFilter) : logs;

  return (
    <div className="animate-fade-in">
      {apps.length > 0 && (
        <div className="mb-4 max-w-xs">
          <Select
            inputSize="sm"
            aria-label="Filter by app"
            value={appFilter}
            onChange={e => setAppFilter(e.target.value)}
          >
            <option value="">All apps</option>
            {apps.map(id => (
              <option key={id} value={id}>
                {shortNameCapitalized(id)}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Card padding="none">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">
            {logs.length === 0 ? "No activity yet." : "No activity for this app yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border px-4">
            {rows.map((log, i) => (
              <HistoryRow key={`${log.timestamp}-${i}`} log={log} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  userActionLogs: getUserActionLogs,
});

export default connect(mapStateToProps)(SystemHistory);
export { SystemHistory };
