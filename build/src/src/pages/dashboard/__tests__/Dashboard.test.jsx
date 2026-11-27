import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "pages/dashboard/components/Dashboard";

const { useHealthMock } = vi.hoisted(() => ({ useHealthMock: vi.fn() }));
vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));
// EthPrice fetches from CoinGecko — stub it so these tests never touch the network.
vi.mock("pages/dashboard/components/EthPrice", () => ({ default: () => <div data-testid="eth-price" /> }));
// NewsCard fetches the news item from bo.ava.do — same reason. Its own tests are in NewsCard.test.jsx.
vi.mock("pages/dashboard/components/NewsCard", () => ({ default: () => <div data-testid="news-card" /> }));
// The factory-password notice asks the DAPPMANAGER through redux; its own tests are in boxPassword.test.jsx.
vi.mock("pages/system/components/BoxPassword", () => ({ DefaultPasswordNotice: () => <div data-testid="password-notice" /> }));
vi.mock("pwa/PhoneAlerts", () => ({ HomeScreenHint: () => <div data-testid="home-screen-hint" /> }));
// Temperatures come from the DAPPMANAGER over WAMP; its own tests are in temperatures.test.jsx.
const { useTemperaturesMock } = vi.hoisted(() => ({ useTemperaturesMock: vi.fn(() => null) }));
vi.mock("pages/dashboard/temperatures", async importOriginal => ({ ...(await importOriginal()), useTemperatures: useTemperaturesMock }));

const baseProps = {
  dappnodeStats: {},
  connection: { isOpen: true },
  fetchDappnodeStats: () => {},
  installedpackages: [],
  history: { push: vi.fn() },
};

const renderDashboard = props =>
  render(
    <MemoryRouter>
      <Dashboard {...baseProps} {...props} />
    </MemoryRouter>
  );

describe("Dashboard apps section", () => {
  it("shows skeletons instead of the empty state while health is not ready, even with zero apps", () => {
    useHealthMock.mockReturnValue({
      verdict: { level: "ok", label: "All good" },
      findings: [],
      checkedAt: new Date(0),
      refresh: () => {},
      checksPassed: 0,
      ready: false,
    });
    const { container } = renderDashboard();
    expect(screen.queryByText("Your AVADO is ready")).not.toBeInTheDocument();
    expect(screen.getByText("Checking your AVADO…")).toBeInTheDocument();
    // Skeleton placeholders fill the apps grid instead (aria-hidden, so not by role).
    expect(container.querySelectorAll(".ui-skeleton").length).toBeGreaterThan(0);
  });

  it("shows the ready empty state once health is ready and there are no apps", () => {
    useHealthMock.mockReturnValue({
      verdict: { level: "ok", label: "All good" },
      findings: [],
      checkedAt: new Date(0),
      refresh: () => {},
      checksPassed: 5,
      ready: true,
    });
    renderDashboard();
    expect(screen.getByText("Your AVADO is ready")).toBeInTheDocument();
  });

  it("includes a non-core package with no manifest, using the package-name fallback", () => {
    useHealthMock.mockReturnValue({
      findings: [],
      updates: {},
      verdict: { level: "ok", label: "All good" },
      checkedAt: new Date(0),
      refresh: () => {},
      checksPassed: 5,
      ready: true,
    });
    renderDashboard({
      installedpackages: [
        { name: "weird.public.dappnode.eth", isCore: false, state: "running", running: true },
      ],
    });
    expect(screen.queryByText("Your AVADO is ready")).not.toBeInTheDocument();
    expect(screen.getByText("weird")).toBeInTheDocument();
  });

  it('titles the section "Running on your AVADO" with an "Add an app" link to the DappStore', () => {
    useHealthMock.mockReturnValue({
      findings: [],
      updates: {},
      verdict: { level: "ok", label: "All good" },
      checkedAt: new Date(0),
      refresh: () => {},
      checksPassed: 5,
      ready: true,
    });
    renderDashboard();
    expect(screen.getByText("Running on your AVADO")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add an app" })).toHaveAttribute("href", "/installer");
  });

  it("lays out the bays grid 1/2/4 columns (mobile/sm/xl) and shows 4 bay skeletons while loading", () => {
    useHealthMock.mockReturnValue({
      findings: [],
      updates: {},
      verdict: { level: "ok", label: "All good" },
      checkedAt: new Date(0),
      refresh: () => {},
      checksPassed: 0,
      ready: false,
    });
    const { container } = renderDashboard();
    const grid = container.querySelector(".grid.grid-cols-1.sm\\:grid-cols-2");
    expect(grid).toHaveClass("xl:grid-cols-4");
    expect(container.querySelectorAll(".ui-skeleton").length).toBeGreaterThan(0);
    // 4 bay-shaped skeletons, each a rounded-tile card (not the old AppCard shape).
    expect(container.querySelectorAll(".rounded-tile").length).toBe(4);
  });
});

describe("Dashboard hero", () => {
  const ready = (verdictLevel, label) => ({
    findings: [],
    updates: {},
    verdict: { level: verdictLevel, label },
    checkedAt: new Date(0),
    refresh: () => {},
    checksPassed: 5,
    ready: true,
  });

  it("no longer draws the AVADO device; verdict, ETH price and box readings share one card", () => {
    useHealthMock.mockReturnValue(ready("ok", "All good"));
    renderDashboard();
    expect(screen.queryByRole("img", { name: /Your AVADO box/ })).not.toBeInTheDocument();
    const hero = screen.getByRole("region", { name: "Your AVADO" });
    expect(hero).toContainElement(screen.getByRole("heading", { name: "Your AVADO is healthy." }));
    expect(hero).toContainElement(screen.getByRole("region", { name: "Box readings" }));
    expect(hero).toContainElement(screen.getByTestId("eth-price"));
  });

  it("puts the news from AVADO right below the hero card and above the apps", () => {
    useHealthMock.mockReturnValue(ready("ok", "All good"));
    renderDashboard();
    const hero = screen.getByRole("region", { name: "Your AVADO" });
    const news = screen.getByTestId("news-card");
    const apps = screen.getByRole("region", { name: "Running on your AVADO" });
    expect(hero.nextElementSibling).toBe(news);
    expect(news.nextElementSibling).toBe(apps);
  });
});

describe("Dashboard lost data", () => {
  it("asks for a new lost-data scan once on each visit", () => {
    const refreshLostData = vi.fn();
    useHealthMock.mockReturnValue({
      verdict: { level: "ok", label: "All good" },
      findings: [],
      checkedAt: new Date(0),
      refresh: () => {},
      checksPassed: 5,
      ready: true,
      refreshLostData,
    });
    const { rerender } = renderDashboard();
    rerender(
      <MemoryRouter>
        <Dashboard {...baseProps} />
      </MemoryRouter>
    );
    expect(refreshLostData).toHaveBeenCalledTimes(1);
  });
});

describe("Dashboard temperatures", () => {
  const healthy = {
    findings: [],
    updates: {},
    verdict: { level: "ok", label: "All good" },
    checkedAt: new Date(0),
    refresh: () => {},
    checksPassed: 5,
    ready: true,
  };
  const core = version => [{ name: "dappmanager.dnp.dappnode.eth", version, isCore: true }];

  it("an older DAPPMANAGER is never asked, and no temperatures are shown", () => {
    useHealthMock.mockReturnValue(healthy);
    useTemperaturesMock.mockClear();
    renderDashboard({ dnps: core("10.0.61") });
    expect(useTemperaturesMock).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("group", { name: "Temperature" })).not.toBeInTheDocument();
  });

  it("DAPPMANAGER 10.0.62: shows them next to processor, memory and disk", () => {
    useHealthMock.mockReturnValue(healthy);
    useTemperaturesMock.mockClear();
    useTemperaturesMock.mockReturnValue([
      { chip: "k10temp", device: "0000:00:18.3", label: "Tctl", celsius: 68.5, high: null, crit: null },
      { chip: "nvme", device: "0000:01:00.0", label: "Composite", celsius: 47.9, high: 117.9, crit: null },
    ]);
    renderDashboard({ dnps: core("10.0.62") });
    expect(useTemperaturesMock).toHaveBeenCalledWith(true);
    const readings = screen.getByRole("region", { name: "Box readings" });
    const temps = screen.getByRole("group", { name: "Temperature" });
    expect(readings).toContainElement(temps);
    expect(temps).toHaveTextContent("Processor69 °C");
    expect(temps).toHaveTextContent("Disk48 °C");
    useTemperaturesMock.mockReturnValue(null);
  });
});
