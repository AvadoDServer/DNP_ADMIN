import { visibleCategories, advancedMatchNames } from "../storeVisibility";

const categories = [
  { tag: "execution", description: "Execution clients", weight: 1 },
  { tag: "ethstaking", description: "ETH Staking", weight: 2 },
  { tag: "testnets", description: "Testnets", weight: 3 },
  { tag: "thelab", description: "The Lab", weight: 4 },
];

describe("visibleCategories", () => {
  it("advanced mode: every category shows, unchanged", () => {
    expect(visibleCategories(categories, { mode: "advanced" })).toBe(categories);
  });

  it("simple mode: drops SIMPLE_HIDDEN_STORE_CATEGORIES", () => {
    const shown = visibleCategories(categories, { mode: "simple" });
    expect(shown.map(c => c.tag)).toEqual(["execution", "ethstaking"]);
  });

  it("simple mode: a deep-linked hidden category (?category=) stays visible", () => {
    const shown = visibleCategories(categories, { mode: "simple", categoryTag: "testnets" });
    expect(shown.map(c => c.tag)).toEqual(["execution", "ethstaking", "testnets"]);
  });

  it("is safe against a non-array categories value", () => {
    expect(visibleCategories(undefined, { mode: "simple" })).toBeUndefined();
  });
});

describe("advancedMatchNames", () => {
  const matches = [
    { manifest: { name: "geth.dnp.dappnode.eth", avadocategory: "execution" } },
    { manifest: { name: "goerli.dnp.dappnode.eth", avadocategory: "testnets" } },
    { manifest: { name: "lab-tool.dnp.dappnode.eth", avadocategory: "thelab" } },
  ];

  it("advanced mode: returns undefined (no badge needed — everything is already visible)", () => {
    expect(advancedMatchNames(matches, "advanced")).toBeUndefined();
  });

  it("simple mode: tags matches whose category is normally hidden from simple", () => {
    const names = advancedMatchNames(matches, "simple");
    expect(names.has("geth.dnp.dappnode.eth")).toBe(false);
    expect(names.has("goerli.dnp.dappnode.eth")).toBe(true);
    expect(names.has("lab-tool.dnp.dappnode.eth")).toBe(true);
  });

  it("is safe against a missing matches array", () => {
    expect(advancedMatchNames(undefined, "simple")).toEqual(new Set());
  });
});
