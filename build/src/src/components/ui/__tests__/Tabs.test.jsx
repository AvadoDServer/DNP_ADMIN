import React from "react";
import { render, screen } from "@testing-library/react";
import Tabs from "../Tabs";

describe("Tabs", () => {
  it("pill-styles the selected tab (tinted accent background, fg text) and leaves the rest muted with no background", () => {
    render(
      <Tabs
        tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]}
        active="a"
        onChange={() => {}}
      />
    );
    const selected = screen.getByRole("tab", { name: "A" });
    const unselected = screen.getByRole("tab", { name: "B" });

    expect(selected).toHaveClass("rounded-full", "bg-accent/10", "text-fg");
    expect(unselected).toHaveClass("rounded-full", "text-fg-muted");
    expect(unselected.className).not.toMatch(/(^|\s)bg-accent/);
  });

  it("carries the focus-ring class on every tab", () => {
    render(
      <Tabs
        tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]}
        active="a"
        onChange={() => {}}
      />
    );
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("focus-visible:shadow-focus");
    }
  });

  it("keeps the tablist keyboard-reachable when active isn't among the rendered tabs", () => {
    render(
      <Tabs
        tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]}
        active="logs"
        onChange={() => {}}
      />
    );
    const tabList = screen.getAllByRole("tab");
    expect(tabList[0]).toHaveAttribute("tabIndex", "0");
    expect(tabList[1]).toHaveAttribute("tabIndex", "-1");
  });
});
