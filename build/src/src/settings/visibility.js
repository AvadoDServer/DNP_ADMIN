/**
 * Simple/Advanced mode visibility helpers.
 *
 * `visibleNavItems` reproduces SideBar.jsx's existing package/hideif
 * filtering exactly (see its `filteredSidenavItems` reduce), then layers the
 * mode rule on top: an item flagged `advanced: true` is dropped in simple
 * mode, unless it's also flagged `simpleIfInstalled: true` — in which case
 * it stays visible in simple mode once its package is installed (Remote
 * Connect: it's how people reach the box from away — spec §5).
 */

function isPackageVisible(item, installedNames) {
  if (!item.package) return true;
  if (!installedNames.includes(item.package)) return false;
  if (item.hideif && item.hideif.some(name => installedNames.includes(name))) return false;
  return true;
}

export function visibleNavItems(items, { mode, installedNames = [] } = {}) {
  return items.filter(item => {
    if (!isPackageVisible(item, installedNames)) return false;
    if (mode === "simple" && item.advanced && !item.simpleIfInstalled) return false;
    return true;
  });
}

// App page tabs hidden in simple mode (spec §5: "App page tabs | Overview,
// Setup | + Logs, Settings, Files"). Tabs are matched by `id` (see
// components/ui/Tabs.jsx / pages/system/components/SystemTabs.jsx shape); a
// plain string tab is matched directly.
export const ADVANCED_TABS = ["logs", "settings", "files"];

export function tabsForMode(tabs, mode) {
  if (mode !== "simple") return tabs;
  return tabs.filter(tab => {
    const key = typeof tab === "string" ? tab : tab && tab.id;
    return !ADVANCED_TABS.includes(key);
  });
}

// DappStore categories hidden in simple mode (spec §5: "DappStore | Curated
// categories | All categories incl. testnets, "The Lab", custom IPFS hash
// box"). Matched against a category's `tag`.
export const SIMPLE_HIDDEN_STORE_CATEGORIES = ["testnets", "thelab", "sunset", "aux", "avadosystem"];
