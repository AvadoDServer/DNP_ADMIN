import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HelpHome from "../HelpHome";

let mockHealth = { allFindings: [], ready: true };
vi.mock("health/HealthProvider", () => ({ useHealth: () => mockHealth }));
// ReportPanel pulls in several redux selectors of its own; isolate HelpHome
// from that wiring, it isn't the concern of this test.
vi.mock("../ReportPanel", () => ({ default: () => <div data-testid="report-panel" /> }));

const renderAt = () =>
  render(
    <MemoryRouter>
      <HelpHome />
    </MemoryRouter>
  );

describe("HelpHome topic tiles", () => {
  it("shows a red dot and 'Action required' for a topic with a critical finding", () => {
    mockHealth = { allFindings: [{ id: "a", severity: "critical", topic: "setup" }], ready: true };
    renderAt();
    const tile = screen.getByRole("link", { name: /Validator setup/ });
    expect(within(tile).getByTestId("severity-dot-setup")).toHaveClass("bg-danger");
    expect(within(tile).getByText("Action required")).toBeInTheDocument();
  });

  it("shows an amber dot and 'Needs attention' for a topic with only a warning finding", () => {
    mockHealth = { allFindings: [{ id: "b", severity: "warning", topic: "storage" }], ready: true };
    renderAt();
    const tile = screen.getByRole("link", { name: /Disk space/ });
    expect(within(tile).getByTestId("severity-dot-storage")).toHaveClass("bg-warning");
    expect(within(tile).getByText("Needs attention")).toBeInTheDocument();
  });

  it("shows a green dot and 'All good' for a topic with no matching findings", () => {
    mockHealth = { allFindings: [], ready: true };
    renderAt();
    const tile = screen.getByRole("link", { name: /Validator setup/ });
    expect(within(tile).getByTestId("severity-dot-setup")).toHaveClass("bg-success");
    expect(within(tile).getByText("All good")).toBeInTheDocument();
  });

  it("shows a neutral 'checking' dot, not green, while health is not ready yet", () => {
    mockHealth = { allFindings: [], ready: false };
    renderAt();
    const tile = screen.getByRole("link", { name: /Validator setup/ });
    const dot = within(tile).getByTestId("severity-dot-setup");
    expect(dot).toHaveClass("bg-fg-subtle");
    expect(dot).not.toHaveClass("bg-success");
    expect(within(tile).getByText("Checking…")).toBeInTheDocument();
  });
});
