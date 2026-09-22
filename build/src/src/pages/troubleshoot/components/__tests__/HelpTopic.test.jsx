import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import HelpTopic from "../HelpTopic";

let mockHealth = { allFindings: [] };
vi.mock("health/HealthProvider", () => ({ useHealth: () => mockHealth }));
// The "Still stuck?" report panel pulls in several redux selectors of its
// own; isolate HelpTopic from that wiring, it isn't the concern of this test.
vi.mock("../ReportPanel", () => ({ default: () => <div data-testid="report-panel" /> }));

const renderAt = topic =>
  render(
    <Provider store={createStore(() => ({}))}>
      <MemoryRouter initialEntries={[`/help/${topic}`]}>
        <Route path="/help/:topic" component={HelpTopic} />
      </MemoryRouter>
    </Provider>
  );

describe("HelpTopic", () => {
  it("renders a not-found page for an unknown topic id", () => {
    mockHealth = { allFindings: [] };
    renderAt("nope");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders the finding rows that match a known topic, and no others", () => {
    mockHealth = {
      allFindings: [
        { id: "disk-high", severity: "warning", topic: "storage", title: "Your disk is 82% full" },
        { id: "other", severity: "critical", topic: "setup", title: "Unrelated finding" },
      ],
    };
    renderAt("storage");
    expect(screen.getByRole("heading", { name: "Disk space" })).toBeInTheDocument();
    expect(screen.getByText("Your disk is 82% full")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated finding")).not.toBeInTheDocument();
  });
});
