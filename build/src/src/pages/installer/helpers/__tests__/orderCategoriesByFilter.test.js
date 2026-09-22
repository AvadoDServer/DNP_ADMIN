import orderCategoriesByFilter from "../orderCategoriesByFilter";

const categories = [
  { tag: "execution", description: "Execution clients", weight: 1 },
  { tag: "ethstaking", description: "ETH Staking", weight: 2 },
  { tag: "monitoring", description: "Monitoring", weight: 3 },
];

describe("orderCategoriesByFilter", () => {
  it("moves the matching category to the front and reports it as highlighted", () => {
    const { ordered, highlighted } = orderCategoriesByFilter(categories, "ethstaking");
    expect(ordered.map((c) => c.tag)).toEqual(["ethstaking", "execution", "monitoring"]);
    expect(highlighted).toBe(categories[1]);
  });

  it("keeps the remaining categories in their original order", () => {
    const { ordered } = orderCategoriesByFilter(categories, "monitoring");
    expect(ordered.map((c) => c.tag)).toEqual(["monitoring", "execution", "ethstaking"]);
  });

  it("ignores an unknown tag: original order, nothing highlighted", () => {
    const { ordered, highlighted } = orderCategoriesByFilter(categories, "does-not-exist");
    expect(ordered).toBe(categories);
    expect(highlighted).toBeUndefined();
  });

  it("ignores a missing tag", () => {
    expect(orderCategoriesByFilter(categories, null)).toEqual({
      ordered: categories,
      highlighted: undefined,
    });
    expect(orderCategoriesByFilter(categories, "")).toEqual({
      ordered: categories,
      highlighted: undefined,
    });
  });

  it("is safe against a non-array categories value", () => {
    expect(orderCategoriesByFilter(undefined, "ethstaking")).toEqual({
      ordered: undefined,
      highlighted: undefined,
    });
  });
});
