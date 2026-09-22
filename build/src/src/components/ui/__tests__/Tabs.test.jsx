import React from "react";
import { render, screen } from "@testing-library/react";
import Tabs from "../Tabs";

// Tabs' native <button>s pick up their look from the global reset in
// index.css (button:not(.btn) { background: transparent; border: 0; ... })
// plus their own border-*/text-* classes — never a background/box class of
// their own. This is a class-level stand-in for that: jsdom doesn't apply
// the real stylesheet, so it can't assert computed background/border, but
// it can assert the classes the reset (and this component) rely on.
describe("Tabs", () => {
  it("tab buttons carry no background/box class and aren't excluded from the reset via .btn", () => {
    render(
      <Tabs
        tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]}
        active="a"
        onChange={() => {}}
      />
    );
    const selected = screen.getByRole("tab", { name: "A" });
    const unselected = screen.getByRole("tab", { name: "B" });

    for (const tab of [selected, unselected]) {
      expect(tab).not.toHaveClass("btn");
      expect(tab.className).not.toMatch(/(^|\s)bg-/);
    }
    // Selected = brand underline; unselected = muted text. No box either way.
    expect(selected).toHaveClass("border-brand", "text-fg");
    expect(unselected).toHaveClass("border-transparent", "text-fg-muted");
  });
});
