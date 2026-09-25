import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "pages/dashboard/components/Dashboard";

const { useHealthMock } = vi.hoisted(() => ({ useHealthMock: vi.fn() }));
vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));
// EthPrice fetches from CoinGecko — stub it so these tests never touch the network.
vi.mock("pages/dashboard/components/EthPrice", () => ({ default: () => <div data-testid="eth-price" /> }));

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
});
