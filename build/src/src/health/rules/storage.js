import { appTitle } from "./apps";

export function parsePercent(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*%?/);
  return m ? Number(m[1]) : null;
}

export const appDiskUse = pkg =>
  ((pkg && pkg.volumes) || []).reduce((sum, v) => sum + (Number(v && v.size) || 0), 0);

export function diskHigh({ stats, packages }) {
  const pct = parsePercent(stats && stats.disk);
  if (pct === null || pct < 80) return null;
  const biggest = [...(packages || [])]
    .map(p => ({ p, size: appDiskUse(p) }))
    .filter(x => x.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 2)
    .map(x => appTitle(x.p));
  return {
    id: "disk-high",
    severity: pct >= 90 ? "critical" : "warning",
    topic: "storage",
    title: `Your disk is ${Math.round(pct)}% full`,
    why:
      (pct >= 90
        ? "When the disk is full your clients stop and your validators go offline. "
        : "Clients keep growing; plan some space now before it becomes urgent. ") +
      (biggest.length ? `Most space is used by ${biggest.join(" and ")}.` : ""),
    fix: { kind: "link", to: "/system/storage", label: "Free up space" },
  };
}
