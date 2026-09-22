import React from "react";
import PropTypes from "prop-types";
import { isEmpty } from "lodash";
// UI kit
import Card from "components/ui/Card";
import ProgressBar from "components/ui/ProgressBar";
import DnpName from "components/DnpName";

function parsePercent(s = "") {
  if (!s.includes("%")) return null;
  // Return string before the first "%" and after the last " "
  const raw = s.split("%")[0].split(" ").slice(-1)[0];
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function ProgressLogs({ progressLogs }) {
  if (isEmpty(progressLogs)) return null;

  const entries = Object.entries(progressLogs)
    // Don't show "core.dnp.dappnode.eth" actual progress log information
    .filter(([dnpName]) => dnpName !== "core.dnp.dappnode.eth");

  if (!entries.length) return null;

  return (
    <Card padding="lg" className="mb-4 flex flex-col gap-4">
      <h2 className="text-sm font-bold text-fg-muted">
        Installing
      </h2>
      <div className="flex flex-col gap-4">
        {entries.map(([dnpName, log = ""]) => {
          const percent = parsePercent(log);
          const progressing = percent != null || log.includes("...");
          return (
            <div key={dnpName} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-fg">
                  <DnpName dnpName={dnpName} />
                </span>
                <span className="flex-shrink-0 truncate text-xs text-fg-subtle" title={log}>
                  {log}
                </span>
              </div>
              <ProgressBar
                value={percent != null ? percent : 100}
                variant={progressing ? "accent" : "success"}
                indeterminate={progressing && percent == null}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * @param {object} progressLogs = {
 *   "dnpName1.dnp.dappnode.eth": "Downloading 64%",
 *   "dnpName2.dnp.dappnode.eth": "Loading...",
 * }
 */
ProgressLogs.propTypes = {
  progressLogs: PropTypes.objectOf(PropTypes.string.isRequired).isRequired,
};

export default ProgressLogs;
