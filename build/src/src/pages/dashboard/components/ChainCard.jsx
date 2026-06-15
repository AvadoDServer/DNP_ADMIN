import React from "react";
import PropTypes from "prop-types";
import Card from "components/ui/Card";
import Badge from "components/ui/Badge";
import ProgressBar from "components/ui/ProgressBar";

/**
 * Chain sync status card. Same props/redux shape as before.
 */
function ChainCard({ name, message, progress, error, syncing }) {
  const progressValue =
    typeof progress === "number" && !isNaN(progress) ? progress : 0;
  const progressPercent = Math.floor(100 * progressValue);

  const status = error
    ? { variant: "danger", label: "Error", bar: "danger", value: 100 }
    : syncing
    ? { variant: "warning", label: "Syncing", bar: "warning", value: progressPercent }
    : { variant: "success", label: "Synced", bar: "success", value: 100 };

  return (
    <Card padding="lg" className="animate-rise">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </span>
          <span className="font-semibold capitalize text-fg">
            {name === "Mainnet" ? "Ethereum" : name}
          </span>
        </div>
        <Badge variant={status.variant} dot={status.variant !== "success"}>
          {status.label}
        </Badge>
      </div>

      <ProgressBar
        value={status.value}
        variant={status.bar}
        indeterminate={syncing && progressPercent === 0}
        className="mt-4"
      />

      {message && (
        <div className="mt-3 truncate text-xs text-fg-subtle" title={message}>
          {message}
        </div>
      )}
    </Card>
  );
}

ChainCard.propTypes = {
  name: PropTypes.string.isRequired,
  message: PropTypes.string,
  progress: PropTypes.number,
};

export default ChainCard;
