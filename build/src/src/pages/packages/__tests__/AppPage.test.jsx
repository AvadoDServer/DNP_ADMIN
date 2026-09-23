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

// Mode (Simple/Advanced) — mutable per test, mirroring the ThemeProvider
// mock above. Defaults to "simple", same as the real ModeProvider's default
// context value, so the existing header-action tests (which never touch
// mode) keep behaving exactly as before.
let mockMode = "simple";
const mockSetMode = vi.fn();
vi.mock("settings/ModeProvider", () => ({
  useMode: () => ({ mode: mockMode, isAdvanced: mockMode === "advanced", setMode: mockSetMode }),
}));

const mockDispatch = vi.fn();
vi.mock("react-redux", async () => {
  const actual = await vi.importActual("react-redux");
  return { ...actual, useDispatch: () => mockDispatch };
});

const mockConfirmRestart = vi.fn();
vi.mock("pages/packages/components/confirmRestartPackage", () => ({
  default: (...args) => mockConfirmRestart(...args),
}));

const mockConfirmReset = vi.fn();
vi.mock("pages/packages/components/confirmResetPackage", () => ({
  default: (...args) => mockConfirmReset(...args),
}));

const mockConfirmStop = vi.fn();
vi.mock("pages/packages/components/confirmStopPackage", () => ({
  default: (...args) => mockConfirmStop(...args),
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
    mockConfirmReset.mockClear();
    mockConfirmStop.mockClear();
    mockSetMode.mockClear();
    mockMode = "simple";
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

  it("overflow menu has no items (Stop, Reset and Remove all hidden) for a core app, so it does not render", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={true} />);
    expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
  });

  it("treats a package as core when dnp.isCore is true, even though the isCore route prop is false (e.g. reached via /packages/<core-id>, not /system/<core-id>)", () => {
    const coreDnp = { ...dnp, isCore: true };
    render(<AppPage dnp={coreDnp} {...baseProps} isCore={false} />);
    expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
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

  it("clicking Stop for a running non-core app confirms first, via confirmStopPackage", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Stop" }));
    expect(mockConfirmStop).toHaveBeenCalledWith(dnp.name, expect.any(Function), "nimbus");
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("clicking Start for a stopped non-core app dispatches immediately, no confirm", () => {
    const stopped = { ...dnp, state: "exited" };
    render(<AppPage dnp={stopped} {...baseProps} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Start" }));
    expect(mockConfirmStop).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it("Reset for a consensus client passes the consensus copy option, with the app's title", () => {
    render(<AppPage dnp={dnp} {...baseProps} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset" }));
    expect(mockConfirmReset).toHaveBeenCalledWith(dnp.name, expect.any(Function), {
      consensus: true,
      title: "nimbus",
    });
  });

  it("Reset for a non-client app does not set the consensus option", () => {
    const other = { ...dnp, name: "rotki.avado.dnp.dappnode.eth" };
    render(<AppPage dnp={other} {...baseProps} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset" }));
    expect(mockConfirmReset).toHaveBeenCalledWith(other.name, expect.any(Function), {
      consensus: false,
      title: "rotki",
    });
  });
});

describe("app page modes", () => {
  const dnpWithSetup = {
    name: "nimbus.avado.dnp.dappnode.eth",
    state: "running",
    version: "1.2.3",
    manifest: { links: { OnboardingWizard: "http://nimbus.my.ava.do" } },
  };
  const baseProps = {
    id: dnpWithSetup.name,
    loading: false,
    history: { replace: vi.fn(), push: vi.fn() },
  };

  it("simple mode: the tab bar only offers Setup and Overview", () => {
    mockMode = "simple";
    render(
      <AppPage dnp={dnpWithSetup} {...baseProps} location={{ pathname: "/packages/x", search: "" }} isCore={false} />
    );
    expect(screen.getAllByRole("tab").map(t => t.textContent)).toEqual(["Setup", "Overview"]);
  });

  it("advanced mode: the tab bar offers every tab", () => {
    mockMode = "advanced";
    render(
      <AppPage dnp={dnpWithSetup} {...baseProps} location={{ pathname: "/packages/x", search: "" }} isCore={false} />
    );
    expect(screen.getAllByRole("tab").map(t => t.textContent)).toEqual([
      "Setup",
      "Overview",
      "Logs",
      "Settings",
      "Files",
    ]);
  });

  it("simple mode + a deep link to an advanced tab (?tab=logs) still opens it, with an Advanced-page note offering a switch", () => {
    mockMode = "simple";
    render(
      <AppPage
        dnp={dnpWithSetup}
        {...baseProps}
        location={{ pathname: "/packages/x", search: "?tab=logs" }}
        isCore={false}
      />
    );
    // The tab bar itself still only shows Setup/Overview — no Logs pill.
    expect(screen.getAllByRole("tab").map(t => t.textContent)).toEqual(["Setup", "Overview"]);
    // The Logs content is there anyway (never a 404), with a note and a way out.
    expect(screen.getByRole("heading", { name: "Logs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to advanced mode" }));
    expect(mockSetMode).toHaveBeenCalledWith("advanced");
  });

  it("advanced mode + ?tab=logs: no Advanced-page note (Logs is already a first-class tab there)", () => {
    mockMode = "advanced";
    render(
      <AppPage
        dnp={dnpWithSetup}
        {...baseProps}
        location={{ pathname: "/packages/x", search: "?tab=logs" }}
        isCore={false}
      />
    );
    expect(screen.queryByRole("button", { name: "Switch to advanced mode" })).not.toBeInTheDocument();
  });

  it("shows the version only in advanced mode", () => {
    mockMode = "simple";
    const { rerender } = render(
      <AppPage dnp={dnpWithSetup} {...baseProps} location={{ pathname: "/packages/x", search: "" }} isCore={false} />
    );
    expect(screen.queryByText("v1.2.3")).not.toBeInTheDocument();

    mockMode = "advanced";
    rerender(
      <AppPage dnp={dnpWithSetup} {...baseProps} location={{ pathname: "/packages/x", search: "" }} isCore={false} />
    );
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
  });
});
