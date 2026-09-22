import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import SystemRoot from "../SystemRoot";

// Every tab's own page used to render its own "System" PageHeader (with a
// per-tab eyebrow) — SystemRoot now renders the one shared header above
// SystemTabs instead, so these stand-ins only need to prove which route
// matched, not re-test each page's own content.
vi.mock("../SystemHome", () => ({ default: () => <p>overview tab</p> }));
vi.mock("../SystemUpdates", () => ({ default: () => <p>updates tab</p> }));
vi.mock("../SystemStorage", () => ({ default: () => <p>storage tab</p> }));
vi.mock("../SystemHistory", () => ({ default: () => <p>history tab</p> }));
vi.mock("../SystemUpdate", () => ({ default: () => <p>core update flow</p> }));
vi.mock("pages/packages/components/AppPage", () => ({ default: () => <p>core app page</p> }));
const { TAB_PATHS } = vi.hoisted(() => ({
  TAB_PATHS: ["/system", "/system/updates", "/system/storage", "/system/history"],
}));
vi.mock("../SystemTabs", () => ({
  default: () => <div role="tablist">tab bar</div>,
  isTabPath: pathname => TAB_PATHS.some(p => p.toLowerCase() === String(pathname || "").toLowerCase()),
}));

const renderAt = path =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route render={props => <SystemRoot {...props} />} />
    </MemoryRouter>
  );

describe("SystemRoot", () => {
  it.each([
    ["/system", "overview tab"],
    ["/system/updates", "updates tab"],
    ["/system/storage", "storage tab"],
    ["/system/history", "history tab"],
  ])("%s shows exactly one 'System' header above the tab bar, then its own tab", (path, text) => {
    renderAt(path);
    expect(screen.getAllByRole("heading", { name: "System" })).toHaveLength(1);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("matches tab paths case-insensitively, same as the react-router routes underneath", () => {
    renderAt("/system/Updates");
    expect(screen.getAllByRole("heading", { name: "System" })).toHaveLength(1);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("updates tab")).toBeInTheDocument();
  });

  it("does not show the System header or tab bar on the core update flow", () => {
    renderAt("/system/update");
    expect(screen.queryByRole("heading", { name: "System" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("core update flow")).toBeInTheDocument();
  });

  it("does not show the System header or tab bar on an individual core app page", () => {
    renderAt("/system/some-core-app.dnp.dappnode.eth");
    expect(screen.queryByRole("heading", { name: "System" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("core app page")).toBeInTheDocument();
  });
});
