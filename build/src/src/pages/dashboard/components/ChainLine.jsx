import React from "react";
import { stringIncludes } from "utils/strings";

// When synced, the backend's `message` (e.g. "50 peers · head 15273229")
// is shown alongside the word "Synced" — unless the message already says
// so itself (e.g. "Synced #0"), in which case showing it alone avoids
// "Synced · Synced #0".
function syncedLabel(message) {
  if (!message) return "Synced";
  return stringIncludes(message, "sync") ? "Synced" : `Synced · ${message}`;
}

export default function ChainLine({ chainData = [] }) {
  if (!chainData.length) return null;
  return (
    <ul className="flex flex-col gap-1 pl-0 text-sm">
      {chainData.map(c => (
        <li key={c.name} className="flex flex-wrap items-center gap-2 text-fg-muted">
          <span className={c.syncing ? "h-2 w-2 rounded-full bg-warning" : "h-2 w-2 rounded-full bg-success"} aria-hidden="true" />
          <span className="font-medium text-fg">{c.name}</span>
          <span>{c.syncing ? c.message || "Syncing" : syncedLabel(c.message)}</span>
        </li>
      ))}
    </ul>
  );
}
