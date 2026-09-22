import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { wizardUrl, tabsFor, AppPage } from "pages/packages/components/AppPage";

describe("app page helpers", () => {
  it("finds the wizard URL", () => {
    expect(wizardUrl({ name: "nimbus.avado.dnp.dappnode.eth", manifest: { links: { OnboardingWizard: "http://nimbus.my.ava.do" } } }, "dark")).toBe("http://nimbus.my.ava.do");
    expect(wizardUrl({ name: "remoteconnect.avado.dnp.dappnode.eth", manifest: {} }, "light")).toBe("http://remoteconnect.my.ava.do/?theme=light");
    expect(wizardUrl({ name: "x", manifest: {} }, "dark")).toBeNull();
  });
  it("only offers Setup when there is a wizard, and defaults to it", () => {
    expect(tabsFor(true).map(t => t.id)).toEqual(["setup", "overview", "logs", "settings", "files"]);
    expect(tabsFor(false).map(t => t.id)).toEqual(["overview", "logs", "settings", "files"]);
  });
});

// Header actions (fix round 1). Rendered on the "logs" tab, which is the
// only tab view with no redux/router dependency of its own, so these tests
// can mount the plain (unconnected) AppPage without a Provider or Router.
vi.mock("health/HealthProvider", () => ({
  useHealth: () => ({ findings: [], updates: {}, allFindings: [] }),
}));
vi.mock("theme/ThemeProvider", () => ({ useTheme: () => ({ theme: "dark" }) }));

const mockDispatch = vi.fn();
vi.mock("react-redux", async () => {
  const actual = await vi.importActual("react-redux");
  return { ...actual, useDispatch: () => mockDispatch };
});

const mockConfirmRestart = vi.fn();
vi.mock("pages/packages/components/confirmRestartPackage", () => ({
  default: (...args) => mockConfirmRestart(...args),
}));

describe("app page header actions", () => {
  const dnp = {
    name: "nimbus.avado.dnp.dappnode.eth",
    state: "running",
    version: "1.2.3",
    manifest: {},
  };
  const baseProps = {
    id: dnp.name,
    loading: false,
    history: { replace: vi.fn(), push: vi.fn() },
    location: { pathname: "/packages/nimbus.avado.dnp.dappnode.eth", search: "?tab=logs" },
  };

  beforeEach(() => {
    mockDispatch.mockClear();
    mockConfirmRestart.mockClear();
  });

  it("shows Restart in the header, wired to the existing confirm flow", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(mockConfirmRestart).toHaveBeenCalledWith(dnp.name, expect.any(Function));
  });

  it("overflow menu lists Stop, Reset and Remove for a non-core running app", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Stop" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reset" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Remove" })).toBeInTheDocument();
  });

  it("overflow menu hides Reset and Remove for a core app", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={true} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Stop" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Reset" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("Escape closes the overflow menu and returns focus to its trigger", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={false} />);
    const trigger = screen.getByRole("button", { name: /more actions/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
