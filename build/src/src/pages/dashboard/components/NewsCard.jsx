import { useEffect, useState } from "react";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { loadNews } from "../newsApi";
import { NEWSLETTER_URL, isNewsVisible, readDismissedNews, dismissNews } from "../news";

/**
 * "News from AVADO": the one item AVADO currently has for box owners, until
 * the owner closes it with "Got it". Renders nothing while it loads and
 * nothing when there is no item for this box, so Home never waits on it or
 * breaks because of it.
 *
 * The title and body come from the network and are rendered as plain text.
 *
 * @param {object} stats getStats, for items meant only for some boxes
 */
export default function NewsCard({ stats, loadImpl = loadNews }) {
  const [item, setItem] = useState(null);
  const [dismissed, setDismissed] = useState(readDismissedNews);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => loadImpl())
      .then(news => {
        if (!cancelled) setItem(news || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadImpl]);

  if (!isNewsVisible(item, { stats, dismissed })) return null;

  const onDismiss = () => {
    dismissNews(item.id);
    setDismissed(readDismissedNews().concat(item.id));
  };

  return (
    <Card as="section" aria-labelledby="news-label" padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p id="news-label" className="mb-1 text-xs font-semibold tracking-wide text-fg-subtle">News from AVADO</p>
        <h2 className="mb-1 break-words font-display text-lg font-semibold text-fg">{item.title}</h2>
        <p className="mb-0 whitespace-pre-line break-words text-sm text-fg">{item.body}</p>
        {item.link && (
          <a href={item.link.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
            {item.link.label}
          </a>
        )}
        <p className="mb-0 mt-2 text-xs text-fg-muted">
          <a href={NEWSLETTER_URL} target="_blank" rel="noopener noreferrer" className="hover:text-fg hover:underline">
            Get important AVADO news by email
          </a>
        </p>
      </div>
      <Button size="sm" variant="secondary" className="shrink-0 self-start" onClick={onDismiss}>
        Got it
      </Button>
    </Card>
  );
}
