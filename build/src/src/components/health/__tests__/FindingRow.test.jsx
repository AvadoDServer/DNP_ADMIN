import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import FindingRow from "components/health/FindingRow";

const { dismissSpy } = vi.hoisted(() => ({ dismissSpy: vi.fn() }));
vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ dismiss: dismissSpy }) }));

beforeEach(() => {
  dismissSpy.mockClear();
});

const renderRow = finding =>
  render(
    <Provider store={createStore(() => ({}))}>
      <MemoryRouter>
        <ul>
          <FindingRow finding={finding} />
        </ul>
      </MemoryRouter>
    </Provider>
  );

const WHY_TEXT = "Without them your validator cannot be reached from outside.";
const STEP_1 = "Open your router's admin page.";

const stepsAndWhyFinding = (overrides = {}) => ({
  id: "ports-closed",
  severity: "warning",
  topic: "access",
  title: "Some ports are closed",
  why: WHY_TEXT,
  fix: { kind: "steps", label: "See how to fix it" },
  steps: [STEP_1, "Forward port 30303 to this device.", "Save and restart your router."],
  ...overrides,
});

describe("FindingRow", () => {
  it("toggling 'Why this matters' shows why without revealing the steps list", () => {
    renderRow(stepsAndWhyFinding());
    fireEvent.click(screen.getByText("Why this matters"));
    expect(screen.getByText(WHY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(STEP_1)).not.toBeInTheDocument();
  });

  it("clicking the steps fix button shows the steps without opening why", () => {
    renderRow(stepsAndWhyFinding());
    fireEvent.click(screen.getByText("See how to fix it"));
    expect(screen.getByText(STEP_1)).toBeInTheDocument();
    // why toggle is still collapsed (shows its closed-state label, not the why text)
    expect(screen.getByText("Why this matters")).toBeInTheDocument();
    expect(screen.queryByText(WHY_TEXT)).not.toBeInTheDocument();
  });

  it("shows Hide for a dismissable finding and calls dismiss(id) when clicked", () => {
    renderRow(
      stepsAndWhyFinding({
        id: "remote-access-missing",
        dismissable: true,
        fix: null,
        steps: undefined,
        why: undefined,
      })
    );
    fireEvent.click(screen.getByText("Hide"));
    expect(dismissSpy).toHaveBeenCalledWith("remote-access-missing");
  });

  it("renders a link to fix.to for a link fix", () => {
    renderRow(
      stepsAndWhyFinding({
        id: "app-stopped:nimbus.avado.dnp.dappnode.eth",
        why: undefined,
        steps: undefined,
        fix: { kind: "link", to: "/packages/nimbus.avado.dnp.dappnode.eth?tab=logs", label: "See why in the logs" },
      })
    );
    const link = screen.getByRole("link", { name: "See why in the logs" });
    expect(link).toHaveAttribute("href", "/packages/nimbus.avado.dnp.dappnode.eth?tab=logs");
  });
});
