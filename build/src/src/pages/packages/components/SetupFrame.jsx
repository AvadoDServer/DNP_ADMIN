import React from "react";

export default function SetupFrame({ url, title }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-[0_1px_0_rgb(var(--border))] dark:border dark:border-border dark:shadow-none">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm text-fg-muted">
        <span className="truncate">Setup provided by {title}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 font-medium text-accent hover:underline">Open in new tab</a>
      </div>
      <iframe title={`${title} setup`} src={url} className="block h-[75vh] w-full border-0 bg-white" />
    </div>
  );
}
