import { shortName } from "utils/format";

const WHY =
  "After an update the app started with empty storage while its old storage is still on this AVADO. Recover it to get the app's data back. Nothing is deleted.";

// The installed package's manifest title, else the package name before the first dot.
function titleOf(packages, name) {
  const pkg = (packages || []).find(p => p && p.name === name);
  return (pkg && pkg.manifest && pkg.manifest.title) || shortName(name);
}

/**
 * A package's data sits in a storage volume no container uses (DAPPMANAGER
 * 10.0.51 listLostData, fetched by HealthProvider as `lostData`): one finding
 * per such volume, linking to the app page's "Recover data" card.
 */
export function lostData({ packages, lostData: entries }) {
  if (!Array.isArray(entries)) return [];
  const findings = [];
  for (const entry of entries) {
    if (!entry || typeof entry.package !== "string" || !Array.isArray(entry.candidates)) continue;
    const title = titleOf(packages, entry.package);
    for (const candidate of entry.candidates) {
      if (!candidate || typeof candidate.name !== "string") continue;
      findings.push({
        id: `lost-data:${entry.package}:${candidate.name}`,
        severity: "warning",
        topic: "setup",
        appId: entry.package,
        title: `${title} has data in an unused storage volume`,
        why: WHY,
        fix: { kind: "link", to: `/packages/${entry.package}?tab=overview`, label: "Recover data" },
        dismissable: true,
      });
    }
  }
  return findings;
}
// Only a DAPPMANAGER of 10.0.51 or newer can say: without it the check never runs.
lostData.needs = "lostData";
