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
 *
 * `nav` is the current mode's visible nav (`settings/visibility.js`
 * `visibleNavItems`, already package/hideif- and mode-filtered — same list
 * SideBar.jsx shows). `advancedNav` is whatever `visibleNavItems` drops
 * *only* because of the mode gate (Advanced-only pages: System, Priority,
 * Connect (VPN), Remote Connect before it's installed) — those, System's own
 * subpages (Updates/Storage/History) and the maintenance actions
 * (restart/cleanup) are still real commands in Simple mode, just marked
 * `restricted: true` so `searchCommands` only surfaces them on an exact
 * label match (spec §5: the palette adds actions in Advanced; Task 9: both
 * actions and Advanced-only pages are "hidden from results unless the query
 * matches their exact label" in Simple).
 */
export function buildCommands({ nav = [], advancedNav = [], packages = [], storePackages = [], topics = [], mode = "advanced" } = {}) {
  const installed = new Set(packages.map(p => p.name));
  const nonCore = packages.filter(p => !p.isCore);
  const restrictedInSimple = mode === "simple";

  return [
    ...nav.map(n => ({ id: `page:${n.href}`, group: "Pages", label: n.name, keywords: "", to: n.href })),
    ...advancedNav.map(n => ({ id: `page:${n.href}`, group: "Pages", label: n.name, keywords: "", to: n.href, restricted: true })),
    { id: "page:updates", group: "Pages", label: "Updates", keywords: "system upgrade version", to: "/system/updates", restricted: restrictedInSimple },
    { id: "page:storage", group: "Pages", label: "Storage", keywords: "disk space full", to: "/system/storage", restricted: restrictedInSimple },
    { id: "page:history", group: "Pages", label: "History", keywords: "activity log", to: "/system/history", restricted: restrictedInSimple },

    ...nonCore.map(p => ({ id: `app:${p.name}`, group: "Your apps", label: appTitle(p), keywords: p.name, to: `/packages/${p.name}` })),

    ...nonCore.map(p => ({
      id: `restart:${p.name}`,
      group: "Actions",
      label: `Restart ${appTitle(p)}`,
      keywords: "restart reboot app",
      action: { type: "restart", id: p.name },
      restricted: restrictedInSimple,
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

    { id: "action:cleanup", group: "Actions", label: "Clean up unused images", keywords: "disk space free prune", action: { type: "diskCleanup" }, restricted: restrictedInSimple },
    { id: "action:report", group: "Actions", label: "Download diagnostics report", keywords: "support help report", to: "/help" },

    // Mode and theme, spec §5 ("... switched in the sidebar footer and from
    // ⌘K") and §3 (Light / Dark / Match computer). Mode is a toggle, so only
    // the switch that actually changes something is offered; theme is a
    // 3-way pick, so all three are always offered. Neither is `restricted` —
    // they're always fully searchable, in both modes.
    ...(mode === "simple"
      ? [{ id: "mode:advanced", group: "Settings", label: "Switch to advanced mode", keywords: "mode advanced expert power user", action: { type: "setMode", value: "advanced" } }]
      : [{ id: "mode:simple", group: "Settings", label: "Switch to simple mode", keywords: "mode simple easy basic", action: { type: "setMode", value: "simple" } }]),
    { id: "theme:light", group: "Settings", label: "Use light theme", keywords: "theme appearance colour color", action: { type: "setTheme", value: "light" } },
    { id: "theme:dark", group: "Settings", label: "Use dark theme", keywords: "theme appearance colour color", action: { type: "setTheme", value: "dark" } },
    { id: "theme:system", group: "Settings", label: "Match computer theme", keywords: "theme appearance colour color system auto", action: { type: "setTheme", value: "system" } },
  ];
}

/**
 * Case-insensitive substring search over label + keywords, ranked:
 * label prefix > label contains > keyword contains. Capped at 20 results.
 * A `restricted` command (Advanced-only pages and actions, in Simple mode —
 * see `buildCommands`) is excluded unless the query is an exact,
 * case-insensitive match on its label, in which case it ranks first; this
 * applies at any query, including empty (so it never appears by default when
 * the palette first opens).
 */
export function searchCommands(commands, query) {
  const q = (query || "").trim().toLowerCase();
  const score = c => {
    const l = c.label.toLowerCase();
    if (c.restricted) return l === q ? 0 : 9;
    if (!q) return 0;
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
