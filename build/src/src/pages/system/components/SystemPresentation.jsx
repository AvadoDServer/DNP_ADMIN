import React from "react";
export { PageHeader, SectionHeader } from "components/ui/PageHeader";
import Spinner from "components/ui/Spinner";
import Button from "components/ui/Button";
import { confirmAlert } from "react-confirm-alert";

/**
 * Presentational helpers local to the System pages. Composed entirely from the
 * shared design-system tokens — no bespoke CSS. Mirrors the tone of the
 * already-migrated Dashboard / My DApps pages.
 */

/** Centered loading state. */
export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-fg-muted">
      <Spinner size="lg" className="text-accent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Inline informational / warning callout. */
export function Callout({ tone = "warning", children }) {
  const tones = {
    warning: "border-warning/30 bg-warning/[0.08] text-fg",
    danger: "border-danger/30 bg-danger/[0.08] text-fg",
    accent: "border-accent/30 bg-accent/[0.08] text-fg",
  };
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${tones[tone] || tones.warning}`}
      role="alert"
    >
      {children}
    </div>
  );
}

/**
 * A confirm dialog rendered via react-confirm-alert's customUI, restyled on the
 * design-system tokens. Behaviour (the confirmAlert calls / actions) is
 * unchanged — only presentation. Shared by every System page that runs a
 * destructive maintenance action (Overview's reboot/disk-cleanup/shutdown,
 * Storage's disk cleanup).
 */
export function Dialog({ heading, text, children }) {
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(var(--bg-inset)/0.72)] backdrop-blur-sm" />
      {/* Appliance panel: radius 20, no border in light (the elevation
          shadow carries it), a hairline border in dark. */}
      <div className="relative w-full max-w-md animate-rise rounded-xl bg-surface-raised text-fg shadow-xl dark:border dark:border-border">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-fg">{heading}</h2>
          <p className="mt-2 text-sm text-fg-muted">{text}</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Confirms, then runs a signed command (`{ command, sig }`, see
 * `pages/system/signedCommands.js`) through `runSignedCmd`. Same "Cancel" /
 * "Start!" dialog every destructive maintenance action has always used —
 * only the command data moved, not the confirmation behaviour.
 *
 * `label` is a short human name for the command ("Disk cleanup", "Shut
 * down") used only for the "Running command…" toast. It is passed
 * separately rather than added to `cmd`, since `cmd` is sent to the backend
 * as-is and its signature only covers `command`.
 */
export function confirmSignedCmd(cmd, desc, runSignedCmd, label) {
  confirmAlert({
    customUI: ({ onClose }) => (
      <Dialog heading={desc.title} text={desc.text}>
        <Button variant="secondary" pill onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          pill
          onClick={() => {
            runSignedCmd(cmd, label);
            onClose();
          }}
        >
          Start!
        </Button>
      </Dialog>
    ),
  });
}
