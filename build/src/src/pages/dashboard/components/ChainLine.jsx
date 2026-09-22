import React from "react";

export default function ChainLine({ chainData = [] }) {
  if (!chainData.length) return null;
  return (
    <ul className="flex flex-col gap-1 pl-0 text-sm">
      {chainData.map(c => (
        <li key={c.name} className="flex flex-wrap items-center gap-2 text-fg-muted">
          <span className={c.syncing ? "h-2 w-2 rounded-full bg-warning" : "h-2 w-2 rounded-full bg-success"} aria-hidden="true" />
          <span className="font-medium text-fg">{c.name}</span>
          <span>{c.syncing ? c.message || "Syncing" : "Synced"}</span>
        </li>
      ))}
    </ul>
  );
}
