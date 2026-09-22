import { buildCommands, searchCommands } from "components/palette/commands";

const commands = buildCommands({
  nav: [{ name: "Home", href: "/dashboard" }, { name: "Help", href: "/help" }],
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus Consensus Client" } }],
  storePackages: [{ manifest: { name: "teku.avado.dnp.dappnode.eth", title: "Teku Consensus Client" } }],
  topics: [{ id: "storage", title: "Disk space", when: "Disk almost full" }],
});

describe("command palette", () => {
  it("covers pages, apps, store, help and actions", () => {
    const groups = new Set(commands.map(c => c.group));
    expect([...groups].sort()).toEqual(["Actions", "DappStore", "Help", "Pages", "Your apps"]);
  });
  it("ranks label prefixes first and matches keywords", () => {
    expect(searchCommands(commands, "nim")[0].label).toBe("Nimbus Consensus Client");
    expect(searchCommands(commands, "restart")[0].label).toBe("Restart Nimbus Consensus Client");
    expect(searchCommands(commands, "full").map(c => c.label)).toContain("Disk space");
    expect(searchCommands(commands, "")).toHaveLength(Math.min(commands.length, 20));
  });
});
