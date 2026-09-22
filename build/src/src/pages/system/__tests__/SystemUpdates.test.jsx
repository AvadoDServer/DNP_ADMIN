import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import SystemUpdates from "pages/system/components/SystemUpdates";

const { useHealthMock, getDnpInstalledMock, getCoreUpdateAvailableMock, getCoreDepsMock } = vi.hoisted(() => ({
  useHealthMock: vi.fn(),
  getDnpInstalledMock: vi.fn(),
  getCoreUpdateAvailableMock: vi.fn(),
  getCoreDepsMock: vi.fn(),
}));

vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));
vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: getDnpInstalledMock }));
vi.mock("services/coreUpdate/selectors", () => ({
  getCoreUpdateAvailable: getCoreUpdateAvailableMock,
  getCoreDeps: getCoreDepsMock,
}));

const renderPage = () =>
  render(
    <Provider store={createStore(() => ({}))}>
      <MemoryRouter>
        <SystemUpdates />
      </MemoryRouter>
    </Provider>
  );

beforeEach(() => {
  getDnpInstalledMock.mockReturnValue([]);
  getCoreUpdateAvailableMock.mockReturnValue(false);
  getCoreDepsMock.mockReturnValue([]);
});

describe("SystemUpdates", () => {
  it("shows the empty state when everything is up to date", () => {
    useHealthMock.mockReturnValue({ updates: {}, sources: { updates: "ok" } });
    renderPage();
    expect(screen.getByText("All apps are up to date.")).toBeInTheDocument();
    expect(screen.getByText("Your AVADO system is up to date.")).toBeInTheDocument();
  });

  it("shows 'Checking for updates…' while sources.updates is 'loading' (incl. before nodeid ever arrives)", () => {
    useHealthMock.mockReturnValue({ updates: {}, sources: { updates: "loading" } });
    renderPage();
    expect(screen.getByText("Checking for updates…")).toBeInTheDocument();
    expect(screen.queryByText("All apps are up to date.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Can't check for updates right now: your AVADO can't reach the AVADO store.")
    ).not.toBeInTheDocument();
  });

  it("shows a quiet explanation when the store can't be reached, instead of the empty state", () => {
    useHealthMock.mockReturnValue({ updates: {}, sources: { updates: "failed" } });
    renderPage();
    expect(
      screen.getByText("Can't check for updates right now: your AVADO can't reach the AVADO store.")
    ).toBeInTheDocument();
    expect(screen.queryByText("All apps are up to date.")).not.toBeInTheDocument();
  });

  it("lists app updates with an Update link, and the core update with Update system", () => {
    useHealthMock.mockReturnValue({
      updates: { "nimbus.avado.dnp.dappnode.eth": { from: "0.0.48", to: "0.0.49" } },
      sources: { updates: "ok" },
    });
    getDnpInstalledMock.mockReturnValue([
      { name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus" } },
    ]);
    getCoreUpdateAvailableMock.mockReturnValue(true);
    getCoreDepsMock.mockReturnValue([
      { name: "dappmanager.dnp.dappnode.eth", from: "0.2.0", to: "0.2.1", manifest: { title: "DAppManager" } },
    ]);

    renderPage();

    expect(screen.getByText("Nimbus")).toBeInTheDocument();
    expect(screen.getByText("0.0.48 → 0.0.49")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update" })).toHaveAttribute(
      "href",
      "/installer/nimbus.avado.dnp.dappnode.eth"
    );

    expect(screen.getByText("DAppManager")).toBeInTheDocument();
    expect(screen.getByText("0.2.0 → 0.2.1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update system" })).toHaveAttribute("href", "/system/update");
  });
});
