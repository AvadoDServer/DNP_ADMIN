import Button from "components/ui/Button";
import Toast from "components/toast/Toast";
import { confirm } from "components/ConfirmDialog";
import { cn } from "components/ui/cn";
import { RESET_LABEL, startIpfsReset, useIpfsReset } from "../ipfsResetApi";

export const CONFIRM_TITLE = "Reset IPFS storage?";
export const CONFIRM_TEXT = [
  "IPFS stores the app packages your AVADO downloads. Resetting it deletes only that cache; your apps and their data are not touched.",
  "IPFS starts again with empty storage, which takes a few minutes. Installs and updates work again once it is back.",
].join("\n");

const pendingToast = message => new Toast({ message, pending: true });

/**
 * The confirm dialog, then the reset (DAPPMANAGER resetIpfsData). Shared by
 * the Home finding (health/fixActions) and System > Storage.
 * origin: "finding" or "storage"
 */
export function confirmIpfsReset({ origin = "storage", startImpl = startIpfsReset } = {}) {
  confirm({
    title: CONFIRM_TITLE,
    text: CONFIRM_TEXT,
    label: RESET_LABEL,
    variant: "primary",
    onClick: () => startImpl({ origin, toastImpl: pendingToast }),
  });
}

/** "Reset IPFS storage"; shows a spinner while a reset runs (from either place). */
export function IpfsResetButton({ origin = "storage", variant = "secondary", size = "sm", className, startImpl }) {
  const reset = useIpfsReset();
  const running = Boolean(reset && reset.status === "running");
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      loading={running}
      onClick={() => confirmIpfsReset({ origin, startImpl })}
    >
      {RESET_LABEL}
    </Button>
  );
}

const NOTICE = {
  running: "border-border bg-bg-subtle text-fg-muted",
  done: "border-success/40 bg-success-subtle text-success-text",
  error: "border-danger/40 bg-danger-subtle text-danger-text",
};

/** The progress or the result of the last reset of this page; nothing before one. */
export function IpfsResetStatus({ className }) {
  const reset = useIpfsReset();
  if (!reset || !NOTICE[reset.status]) return null;
  return (
    <div
      role={reset.status === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2 text-sm", NOTICE[reset.status], className)}
    >
      {reset.text}
    </div>
  );
}
