import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import SystemHistory, { humaniseEvent } from "pages/system/components/SystemHistory";

const { getUserActionLogsMock } = vi.hoisted(() => ({ getUserActionLogsMock: vi.fn() }));
vi.mock("services/userActionLogs/selectors", () => ({ getUserActionLogs: getUserActionLogsMock }));

const renderPage = () =>
  render(
    <Provider store={createStore(() => ({}))}>
      <SystemHistory />
    </Provider>
  );

describe("humaniseEvent", () => {
  it("turns a camelCase event into readable words, dropping the DNP name", () => {
    expect(humaniseEvent("restartPackage.dappmanager.dnp.dappnode.eth")).toBe("Restart package");
    expect(humaniseEvent("installPackage.nimbus.avado.dnp.dappnode.eth")).toBe("Install package");
    expect(humaniseEvent("")).toBe("");
    expect(humaniseEvent(undefined)).toBe("");
  });
});

describe("SystemHistory", () => {
  it("shows 'No activity yet.' when there are no logs", () => {
    getUserActionLogsMock.mockReturnValue([]);
    renderPage();
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });

  it("renders the humanised event and the app, and never dumps raw kwargs", () => {
    getUserActionLogsMock.mockReturnValue([
      {
        event: "restartPackage.dappmanager.dnp.dappnode.eth",
        kwargs: { id: "dappmanager.dnp.dappnode.eth", userSetVols: { foo: "bar" } },
        level: "info",
        message: "Package restarted",
        timestamp: "2026-09-20T10:00:00.000Z",
      },
    ]);
    renderPage();

    const row = screen.getByText("Restart package").closest("li");
    expect(within(row).getByText("Dappmanager")).toBeInTheDocument();
    expect(screen.getByText("Package restarted")).toBeInTheDocument();
    // kwargs beyond `id` are never shown, anywhere on the page
    expect(screen.queryByText(/userSetVols/)).not.toBeInTheDocument();
    expect(screen.queryByText(/foo.*bar/)).not.toBeInTheDocument();
  });

  it("filters the list by app", () => {
    getUserActionLogsMock.mockReturnValue([
      {
        event: "restartPackage.dappmanager.dnp.dappnode.eth",
        kwargs: { id: "dappmanager.dnp.dappnode.eth" },
        level: "info",
        message: "Package restarted",
        timestamp: "2026-09-20T10:00:00.000Z",
      },
      {
        event: "installPackage.nimbus.avado.dnp.dappnode.eth",
        kwargs: { id: "nimbus.avado.dnp.dappnode.eth" },
        level: "info",
        message: "Package installed",
        timestamp: "2026-09-19T10:00:00.000Z",
      },
    ]);
    renderPage();

    expect(screen.getByText("Package restarted")).toBeInTheDocument();
    expect(screen.getByText("Package installed")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by app"), {
      target: { value: "nimbus.avado.dnp.dappnode.eth" },
    });

    expect(screen.queryByText("Package restarted")).not.toBeInTheDocument();
    expect(screen.getByText("Package installed")).toBeInTheDocument();
  });
});
