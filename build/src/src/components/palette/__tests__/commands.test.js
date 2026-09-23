import { buildCommands, searchCommands } from "components/palette/commands";

const baseArgs = {
  nav: [{ name: "Home", href: "/dashboard" }, { name: "Help", href: "/help" }],
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus Consensus Client" } }],
  storePackages: [{ manifest: { name: "teku.avado.dnp.dappnode.eth", title: "Teku Consensus Client" } }],
  topics: [{ id: "storage", title: "Disk space", when: "Disk almost full" }],
};

const commands = buildCommands(baseArgs);

describe("command palette", () => {
  it("covers pages, apps, store, help, actions and settings", () => {
    const groups = new Set(commands.map(c => c.group));
    expect([...groups].sort()).toEqual(["Actions", "DappStore", "Help", "Pages", "Settings", "Your apps"]);
  });
  it("ranks label prefixes first and matches keywords", () => {
    expect(searchCommands(commands, "nim")[0].label).toBe("Nimbus Consensus Client");
    expect(searchCommands(commands, "restart")[0].label).toBe("Restart Nimbus Consensus Client");
    expect(searchCommands(commands, "full").map(c => c.label)).toContain("Disk space");
    expect(searchCommands(commands, "")).toHaveLength(Math.min(commands.length, 20));
  });

  describe("mode and theme commands", () => {
    it("offers only the mode switch that actually changes something", () => {
      const simpleLabels = buildCommands({ ...baseArgs, mode: "simple" })
        .filter(c => c.group === "Settings")
        .map(c => c.label);
      expect(simpleLabels).toContain("Switch to advanced mode");
      expect(simpleLabels).not.toContain("Switch to simple mode");

      const advancedLabels = buildCommands({ ...baseArgs, mode: "advanced" })
        .filter(c => c.group === "Settings")
        .map(c => c.label);
      expect(advancedLabels).toContain("Switch to simple mode");
      expect(advancedLabels).not.toContain("Switch to advanced mode");
    });

    it("always offers all three theme commands, in both modes", () => {
      for (const mode of ["simple", "advanced"]) {
        const labels = buildCommands({ ...baseArgs, mode })
          .filter(c => c.group === "Settings")
          .map(c => c.label);
        expect(labels).toEqual(
          expect.arrayContaining(["Use light theme", "Use dark theme", "Match computer theme"])
        );
      }
    });

    it("mode and theme commands are never restricted", () => {
      const settingsCommands = buildCommands({ ...baseArgs, mode: "simple" }).filter(c => c.group === "Settings");
      expect(settingsCommands.every(c => !c.restricted)).toBe(true);
    });

    it("wires setMode/setTheme actions with the expected values", () => {
      const simple = buildCommands({ ...baseArgs, mode: "simple" });
      expect(simple.find(c => c.label === "Switch to advanced mode").action).toEqual({ type: "setMode", value: "advanced" });
      expect(simple.find(c => c.label === "Use light theme").action).toEqual({ type: "setTheme", value: "light" });
      expect(simple.find(c => c.label === "Use dark theme").action).toEqual({ type: "setTheme", value: "dark" });
      expect(simple.find(c => c.label === "Match computer theme").action).toEqual({ type: "setTheme", value: "system" });
    });
  });

  describe("restricted commands in Simple mode", () => {
    const restrictedArgs = {
      ...baseArgs,
      advancedNav: [{ name: "System", href: "/system" }],
      mode: "simple",
    };
    const simpleCommands = buildCommands(restrictedArgs);

    it("marks restart, cleanup, System subpages and advancedNav pages as restricted", () => {
      const byLabel = Object.fromEntries(simpleCommands.map(c => [c.label, c]));
      expect(byLabel["Restart Nimbus Consensus Client"].restricted).toBe(true);
      expect(byLabel["Clean up unused images"].restricted).toBe(true);
      expect(byLabel["Updates"].restricted).toBe(true);
      expect(byLabel["Storage"].restricted).toBe(true);
      expect(byLabel["History"].restricted).toBe(true);
      expect(byLabel["System"].restricted).toBe(true);
    });

    it("does not restrict ordinary pages, apps, store or help entries", () => {
      const byLabel = Object.fromEntries(simpleCommands.map(c => [c.label, c]));
      expect(byLabel["Home"].restricted).toBeFalsy();
      expect(byLabel["Nimbus Consensus Client"].restricted).toBeFalsy();
      expect(byLabel["Teku Consensus Client"].restricted).toBeFalsy();
      expect(byLabel["Disk space"].restricted).toBeFalsy();
      expect(byLabel["Download diagnostics report"].restricted).toBeFalsy();
    });

    it("hides restricted commands from an empty-query browse", () => {
      const labels = searchCommands(simpleCommands, "").map(c => c.label);
      expect(labels).not.toContain("Restart Nimbus Consensus Client");
      expect(labels).not.toContain("Clean up unused images");
      expect(labels).not.toContain("System");
    });

    it("hides restricted commands from a partial-text match", () => {
      expect(searchCommands(simpleCommands, "restart")).toEqual([]);
      expect(searchCommands(simpleCommands, "clean")).toEqual([]);
      // "syst" also keyword-matches the (non-restricted) "Match computer
      // theme" command, so assert on the restricted System page specifically
      // rather than the whole result set being empty.
      expect(searchCommands(simpleCommands, "syst").map(c => c.label)).not.toContain("System");
    });

    it("surfaces a restricted command on an exact, case-insensitive label match", () => {
      expect(searchCommands(simpleCommands, "Clean up unused images")[0].label).toBe("Clean up unused images");
      expect(searchCommands(simpleCommands, "system")[0].label).toBe("System");
      expect(searchCommands(simpleCommands, "STORAGE")[0].label).toBe("Storage");
    });

    it("no command is restricted outside Simple mode", () => {
      const advancedCommands = buildCommands({ ...baseArgs, advancedNav: [], mode: "advanced" });
      expect(advancedCommands.every(c => !c.restricted)).toBe(true);
      expect(searchCommands(advancedCommands, "restart")[0].label).toBe("Restart Nimbus Consensus Client");
    });
  });
});
