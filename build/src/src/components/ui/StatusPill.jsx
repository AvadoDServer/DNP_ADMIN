import React from "react";
import { cn } from "./cn";

const DOT_TONE = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
  neutral: "bg-fg-subtle",
};

// Text only turns tone-coloured for states that need attention (warning /
// danger / an available update); a healthy "Running" reads as quiet muted
// text, same as the mockups — only the dot carries the "everything is
// fine" green.
const TEXT_TONE = {
  success: "text-fg-muted",
  warning: "text-warning",
  danger: "text-danger",
  accent: "text-accent",
  neutral: "text-fg-muted",
};

/** The bare status dot, 8-10px, reusable anywhere a StatusPill's word isn't wanted (e.g. an app bay's corner light). */
export function StatusDot({ tone = "neutral", className }) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={cn("inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full", DOT_TONE[tone] || DOT_TONE.neutral, className)}
    />
  );
}

/**
 * StatusPill — the "status light": a small dot plus its word, no pill
 * border/background. Same props as before (`status: { tone, label }`).
 */
export default function StatusPill({ status, className }) {
  const tone = (status && status.tone) || "neutral";
  return (
    <span data-tone={tone} className={cn("inline-flex items-center gap-2 text-sm font-medium leading-5", TEXT_TONE[tone], className)}>
      <StatusDot tone={tone} />
      {status && status.label}
    </span>
  );
}
