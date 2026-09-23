import { visibleNavItems, tabsForMode, ADVANCED_TABS, SIMPLE_HIDDEN_STORE_CATEGORIES } from "../visibility";
import { sidenavItems } from "components/navbar/navbarItems";

const names = items => items.map(i => i.name);

describe("visibleNavItems", () => {
  it("simple mode: core pages only (Priority included — it's the paid support offer, not an advanced tool), Remote Connect absent when not installed", () => {
    const visible = visibleNavItems(sidenavItems, { mode: "simple", installedNames: [] });
    expect(names(visible)).toEqual(["Home", "DappStore", "My DApps", "Staking setup", "Priority", "Help"]);
  });

  it("simple mode: Remote Connect stays visible once its package is installed", () => {
    const visible = visibleNavItems(sidenavItems, {
      mode: "simple",
      installedNames: ["remoteconnect.avado.dnp.dappnode.eth"],
    });
    expect(names(visible)).toEqual([
      "Home",
      "DappStore",
      "My DApps",
      "Staking setup",
      "Remote Connect",
      "Priority",
      "Help",
    ]);
  });

  it("simple mode: Connect (VPN) never shows, even installed (it's advanced-only, unlike Remote Connect)", () => {
    const visible = visibleNavItems(sidenavItems, {
      mode: "simple",
      installedNames: ["vpn.dnp.dappnode.eth"],
    });
    expect(names(visible)).not.toContain("Connect (VPN)");
  });

  it("advanced mode: everything shows (package/hideif rules still applied)", () => {
    const visible = visibleNavItems(sidenavItems, { mode: "advanced", installedNames: [] });
    expect(names(visible)).toEqual([
      "Home",
      "DappStore",
      "My DApps",
      "Staking setup",
      "Priority",
      "Help",
      "System",
    ]);
  });

  it("advanced mode: Connect (VPN) shows once vpn is installed", () => {
    const visible = visibleNavItems(sidenavItems, {
      mode: "advanced",
      installedNames: ["vpn.dnp.dappnode.eth"],
    });
    expect(names(visible)).toContain("Connect (VPN)");
  });

  it("advanced mode: hideif still suppresses Connect (VPN) once Remote Connect is also installed", () => {
    const visible = visibleNavItems(sidenavItems, {
      mode: "advanced",
      installedNames: ["vpn.dnp.dappnode.eth", "remoteconnect.avado.dnp.dappnode.eth"],
    });
    expect(names(visible)).not.toContain("Connect (VPN)");
    expect(names(visible)).toContain("Remote Connect");
  });

  it("reproduces SideBar's package/hideif filtering exactly, on a generic fixture (order preserved)", () => {
    const items = [
      { name: "Always", href: "/a" },
      { name: "NeedsPkg", href: "/b", package: "pkg.a" },
      { name: "HideableA", href: "/c", package: "pkg.a", hideif: ["pkg.b"] },
      { name: "HideableB", href: "/d", package: "pkg.b" },
    ];
    expect(names(visibleNavItems(items, { mode: "advanced", installedNames: [] }))).toEqual(["Always"]);
    expect(names(visibleNavItems(items, { mode: "advanced", installedNames: ["pkg.a"] }))).toEqual([
      "Always",
      "NeedsPkg",
      "HideableA",
    ]);
    expect(
      names(visibleNavItems(items, { mode: "advanced", installedNames: ["pkg.a", "pkg.b"] }))
    ).toEqual(["Always", "NeedsPkg", "HideableB"]);
  });

  it("defaults installedNames to an empty list when omitted", () => {
    expect(() => visibleNavItems(sidenavItems, { mode: "simple" })).not.toThrow();
  });
});

describe("tabsForMode", () => {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "setup", label: "Setup" },
    { id: "logs", label: "Logs" },
    { id: "settings", label: "Settings" },
    { id: "files", label: "Files" },
  ];

  it("simple mode drops ADVANCED_TABS", () => {
    expect(tabsForMode(tabs, "simple").map(t => t.id)).toEqual(["overview", "setup"]);
  });

  it("advanced mode keeps every tab", () => {
    expect(tabsForMode(tabs, "advanced")).toEqual(tabs);
  });
});

describe("constants", () => {
  it("ADVANCED_TABS", () => {
    expect(ADVANCED_TABS).toEqual(["logs", "settings", "files"]);
  });

  it("SIMPLE_HIDDEN_STORE_CATEGORIES", () => {
    expect(SIMPLE_HIDDEN_STORE_CATEGORIES).toEqual(["testnets", "thelab", "sunset", "aux", "avadosystem"]);
  });
});
