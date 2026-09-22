import { cn } from "components/ui/cn";

describe("test setup", () => {
  it("resolves src aliases", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
