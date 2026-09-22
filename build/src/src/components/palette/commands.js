import { appTitle } from "health/rules/apps";

/**
 * Assembles the flat list of ⌘K palette commands from the app's own building
 * blocks: the sidebar's nav items, installed packages, the DappStore
 * catalogue and the troubleshoot topics (Task 15). Restart runs through the
 * same confirm flow every other restart button uses
 * (`pages/packages/components/confirmRestartPackage`) and disk cleanup
 * through the signed-command confirm flow System → Storage uses
 * (`pages/system/signedCommands`); this module only describes *what* those
 * actions are, `CommandPalette.jsx` wires up the confirmation + dispatch.
 */
export function buildCommands({ nav = [], packages = [], storePackages = [], topics = [] } = {}) {
  const installed = new Set(packages.map(p => p.name));
  const nonCore = packages.filter(p => !p.isCore);

  return [
    ...nav.map(n => ({ id: `page:${n.href}`, group: "Pages", label: n.name, keywords: "", to: n.href })),
    { id: "page:updates", group: "Pages", label: "Updates", keywords: "system upgrade version", to: "/system/updates" },
    { id: "page:storage", group: "Pages", label: "Storage", keywords: "disk space full", to: "/system/storage" },
    { id: "page:history", group: "Pages", label: "History", keywords: "activity log", to: "/system/history" },

    ...nonCore.map(p => ({ id: `app:${p.name}`, group: "Your apps", label: appTitle(p), keywords: p.name, to: `/packages/${p.name}` })),

    ...nonCore.map(p => ({
      id: `restart:${p.name}`,
      group: "Actions",
      label: `Restart ${appTitle(p)}`,
      keywords: "restart reboot app",
      action: { type: "restart", id: p.name },
    })),

    ...(storePackages || [])
      .filter(p => p.manifest && !installed.has(p.manifest.name))
      .map(p => ({
        id: `store:${p.manifest.name}`,
        group: "DappStore",
        label: p.manifest.title || p.manifest.name,
        keywords: `install ${p.manifest.name}`,
        to: `/installer/${p.manifest.name}`,
      })),

    ...topics.map(t => ({ id: `help:${t.id}`, group: "Help", label: t.title, keywords: t.when, to: `/help/${t.id}` })),

    { id: "action:cleanup", group: "Actions", label: "Clean up unused images", keywords: "disk space free prune", action: { type: "diskCleanup" } },
    { id: "action:report", group: "Actions", label: "Download diagnostics report", keywords: "support help report", to: "/help" },
  ];
}

/**
 * Case-insensitive substring search over label + keywords, ranked:
 * label prefix > label contains > keyword contains. Capped at 20 results.
 */
export function searchCommands(commands, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return commands.slice(0, 20);
  const score = c => {
    const l = c.label.toLowerCase();
    if (l.startsWith(q)) return 0;
    if (l.includes(q)) return 1;
    if ((c.keywords || "").toLowerCase().includes(q)) return 2;
    return 9;
  };
  return commands
    .map(c => [score(c), c])
    .filter(([s]) => s < 9)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 20)
    .map(([, c]) => c);
}
