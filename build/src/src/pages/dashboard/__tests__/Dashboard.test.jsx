import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "pages/dashboard/components/Dashboard";

const { useHealthMock } = vi.hoisted(() => ({ useHealthMock: vi.fn() }));
vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));

const baseProps = {
  chainData: [],
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
});
