import React from "react";
import PropTypes from "prop-types";
import Card from "components/ui/Card";
import ProgressBar from "components/ui/ProgressBar";
import { cn } from "components/ui/cn";

// CPU / Memory / Disk glyphs — line icons matched to the resource.
const ICONS = {
  Cpu: (
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M6 6h12v12H6zM9.5 9.5h5v5h-5z" />
  ),
  Memory: (
    <path d="M3 7h18v8H3zM7 15v3M11 15v3M15 15v3M7 10h.01M11 10h.01M15 10h.01" />
  ),
  Disk: (
    <path d="M22 12A10 10 0 1 1 12 2M12 12l5.5-5.5M12 12a2 2 0 1 0 0-.01" />
  ),
};

function statusFor(value) {
  if (value > 90) return "danger";
  if (value > 75) return "warning";
  return "success";
}

const STATUS_TEXT = {
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success",
};

/**
 * Resource usage stat card (CPU / Memory / Disk).
 * Same props as before — `percent` is a string like "35%".
 */
function StatsCard({ id, percent, used, total, subtitle }) {
  const value = parseInt(percent, 10) || 0;
  const status = statusFor(value);

  return (
    <Card padding="lg" className="animate-rise">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[id] || ICONS.Cpu}
            </svg>
          </span>
          <div>
            <div className="text-sm font-semibold capitalize text-fg">{id}</div>
            <div className="text-xs text-fg-subtle">usage</div>
          </div>
        </div>
        <div className={cn("text-2xl font-bold tabular-nums", STATUS_TEXT[status])}>
          {value}
          <span className="ml-0.5 text-base font-semibold text-fg-subtle">%</span>
        </div>
      </div>

      <ProgressBar value={value} variant={status} className="mt-4" />

      {used && total ? (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-medium text-fg-muted">{used} used</span>
          <span className="text-fg-subtle">{total} total</span>
        </div>
      ) : subtitle ? (
        <div className="mt-3 truncate text-xs text-fg-subtle" title={subtitle}>
          {subtitle}
        </div>
      ) : null}
    </Card>
  );
}

StatsCard.propTypes = {
  id: PropTypes.string.isRequired,
  percent: PropTypes.string,
  used: PropTypes.string,
  total: PropTypes.string,
  subtitle: PropTypes.string,
};

export default StatsCard;
