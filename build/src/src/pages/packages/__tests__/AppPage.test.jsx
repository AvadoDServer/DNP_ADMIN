import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
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
// Installed packages, mutable per test like mockMode below (the "Charts"
// button needs Grafana and Prometheus installed).
let mockPackages = [];
vi.mock("health/HealthProvider", () => ({
  useHealth: () => ({ findings: [], updates: {}, allFindings: [], packages: mockPackages }),
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
    mockPackages = [];
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
    // Env vars so the Settings tab (Envs) actually renders content instead
    // of null, for the ?tab=settings deep-link case below.
    envs: { EXAMPLE_VAR: "value" },
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

  const ADVANCED_TAB_HEADINGS = {
    logs: "Logs",
    settings: "Environment variables",
    files: "File manager",
  };

  it.each(["logs", "settings", "files"])(
    "simple mode + a deep link to an advanced tab (?tab=%s) still opens it, with an Advanced-page note offering a switch",
    tab => {
      mockMode = "simple";
      render(
        // Settings and Files render redux-connected content (Envs, FileManager's
        // To/From), unlike Logs, so they need a real store in context.
        <Provider store={createStore(() => ({}))}>
          <AppPage
            dnp={dnpWithSetup}
            {...baseProps}
            location={{ pathname: "/packages/x", search: `?tab=${tab}` }}
            isCore={false}
          />
        </Provider>
      );
      // The tab bar itself still only shows Setup/Overview — no pill for the deep-linked tab.
      expect(screen.getAllByRole("tab").map(t => t.textContent)).toEqual(["Setup", "Overview"]);
      // The tab's content is there anyway (never a 404), with a note and a way out.
      expect(screen.getByRole("heading", { name: ADVANCED_TAB_HEADINGS[tab] })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Switch to advanced mode" }));
      expect(mockSetMode).toHaveBeenCalledWith("advanced");
    }
  );

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

describe("app page Charts button", () => {
  const baseProps = {
    loading: false,
    history: { replace: vi.fn(), push: vi.fn() },
    location: { pathname: "/packages/x", search: "?tab=logs" },
  };
  const app = name => ({ name, state: "running", running: true, version: "1.0.0", manifest: {} });
  const grafana = (version = "0.0.5", running = true) => ({ ...app("grafana.avado.dappnode.eth"), version, running, state: running ? "running" : "exited" });
  const prometheus = (running = true) => ({ ...app("prometheus.avado.dappnode.eth"), version: "0.0.2", running, state: running ? "running" : "exited" });
  const renderPage = dnp => render(<AppPage dnp={dnp} id={dnp.name} {...baseProps} isCore={false} />);

  beforeEach(() => {
    mockMode = "simple";
    mockPackages = [];
  });

  it("opens the app's Grafana dashboard in a new tab once Grafana 0.0.3+ and Prometheus run", () => {
    const teku = app("teku-holesky.avado.dnp.dappnode.eth");
    mockPackages = [grafana(), prometheus(), teku];
    renderPage(teku);
    const link = screen.getByRole("link", { name: "Charts" });
    expect(link).toHaveAttribute("href", "http://grafana.my.ava.do:3000/d/avado-teku?var-system=teku-holesky.my.ava.do:8008");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("on a phone it moves into the ⋯ menu, so the header keeps to Open, Restart and ⋯", () => {
    const nimbus = app("nimbus.avado.dnp.dappnode.eth");
    const url = "http://grafana.my.ava.do:3000/d/avado-nimbus?var-instance=nimbus.my.ava.do:8008";
    mockPackages = [grafana(), prometheus(), nimbus];
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPage(nimbus);
    // The header button shows from the sm breakpoint up only.
    expect(screen.getByRole("link", { name: "Charts" }).className).toMatch(/(^| )hidden sm:inline-flex( |$)/);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    const item = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Charts" });
    // ...and the menu item below it only; first, before Stop, Reset and Remove.
    expect(item.className).toMatch(/(^| )sm:hidden( |$)/);
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map(i => i.textContent)).toEqual(["Charts", "Stop", "Reset", "Remove"]);
    fireEvent.click(item);
    expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("the ⋯ menu has no Charts item without a dashboard", () => {
    const nimbus = app("nimbus.avado.dnp.dappnode.eth");
    mockPackages = [nimbus];
    renderPage(nimbus);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(within(screen.getByRole("menu")).queryByRole("menuitem", { name: "Charts" })).not.toBeInTheDocument();
  });

  it("is there for the Prysm validator app too", () => {
    const validator = app("eth2validator.avado.dnp.dappnode.eth");
    mockPackages = [grafana("0.0.3"), prometheus(), validator];
    renderPage(validator);
    expect(screen.getByRole("link", { name: "Charts" })).toHaveAttribute("href", "http://grafana.my.ava.do:3000/d/avado-prysm");
  });

  it("is hidden without Grafana, with Grafana 0.0.2 or stopped, or with Prometheus stopped", () => {
    const nimbus = app("nimbus.avado.dnp.dappnode.eth");
    for (const installed of [[nimbus], [grafana("0.0.2"), prometheus(), nimbus], [grafana("0.0.5", false), prometheus(), nimbus], [grafana(), prometheus(false), nimbus]]) {
      mockPackages = installed;
      const { unmount } = renderPage(nimbus);
      expect(screen.queryByRole("link", { name: "Charts" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("is hidden on apps without a dashboard (Lighthouse, Grafana itself)", () => {
    const lighthouse = app("lighthouse.avado.dnp.dappnode.eth");
    mockPackages = [grafana(), prometheus(), lighthouse];
    const { unmount } = renderPage(lighthouse);
    expect(screen.queryByRole("link", { name: "Charts" })).not.toBeInTheDocument();
    unmount();
    renderPage(grafana());
    expect(screen.queryByRole("link", { name: "Charts" })).not.toBeInTheDocument();
  });
});
