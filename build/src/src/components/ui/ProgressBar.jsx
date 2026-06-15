import React from "react";
import { cn } from "./cn";

const VARIANT_FILL = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * ProgressBar — token-driven track + fill.
 * value: 0..100. variant: accent | success | warning | danger.
 * indeterminate: animated striped sweep when progress is unknown.
 */
const ProgressBar = ({
  value = 0,
  variant = "accent",
  indeterminate = false,
  showLabel = false,
  size = "md",
  className,
  ...props
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const height = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-[rgb(var(--surface-hover))]", height, className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          VARIANT_FILL[variant] || VARIANT_FILL.accent,
          indeterminate && "w-2/5 animate-[shimmer_1.4s_ease-in-out_infinite]"
        )}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      >
        {showLabel && pct > 8 && (
          <span className="sr-only">{pct}%</span>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;
