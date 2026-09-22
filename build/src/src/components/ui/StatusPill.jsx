import React from "react";
import { cn } from "./cn";

const TONES = {
  success: "text-success bg-success/10 border-success/25",
  warning: "text-warning bg-warning/12 border-warning/25",
  danger: "text-danger bg-danger/10 border-danger/25",
  accent: "text-accent bg-accent/10 border-accent/25",
  neutral: "text-fg-muted bg-fg/[0.05] border-border",
};
const DOTS = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", accent: "bg-accent", neutral: "bg-fg-subtle" };

export default function StatusPill({ status, className }) {
  const tone = (status && status.tone) || "neutral";
  return (
    <span
      data-tone={tone}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5", TONES[tone], className)}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />
      {status && status.label}
    </span>
  );
}
