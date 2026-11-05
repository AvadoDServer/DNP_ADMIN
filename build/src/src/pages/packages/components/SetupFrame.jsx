import Button from "components/ui/Button";
import { isBlockedFrame } from "utils/boxUrls";

export default function SetupFrame({ url, title }) {
  // On the secure address (https://admin.my.ava.do) a browser does not show a
  // plain-http app page inside the Admin, so the app opens in its own tab
  if (isBlockedFrame(url)) {
    return (
      <div className="rounded-xl bg-surface p-5 shadow-[0_1px_0_rgb(var(--border))] dark:border dark:border-border dark:shadow-none">
        <p className="mb-4 text-sm text-fg-muted">{title} opens in its own window.</p>
        <Button as="a" href={url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          Open {title}
        </Button>
      </div>
    );
  }
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
