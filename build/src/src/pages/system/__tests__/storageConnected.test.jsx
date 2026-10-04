import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { ModeProvider } from "settings/ModeProvider";
import ConnectedSystemStorage from "pages/system/components/SystemStorage";

// The connected page, not the bare component: "Free up space" must reach the
// real packages action through redux (10.0.60 shipped with it wired to the
// system actions, where it does not exist, so the button did nothing).

const TEKU = "teku.avado.dnp.dappnode.eth";
const PACKAGES = [
  { name: TEKU, version: "0.0.76", volumes: [{ size: "883GB" }], manifest: { title: "Teku" } },
  { name: "dappmanager.dnp.dappnode.eth", version: "10.0.50", isCore: true, volumes: [] },
];

vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ diskForecast: { state: "none" }, diskTrendStatus: "not-installed" }) }));
vi.mock("services/dnpInstalled/selectors", async importOriginal => ({
  ...(await importOriginal()),
  getDnpInstalled: () => PACKAGES,
}));
vi.mock("services/dappnodeStatus/selectors", async importOriginal => ({
  ...(await importOriginal()),
  getDappnodeStats: () => ({ disk: "50%" }),
  getDappnodeParams: () => ({}),
}));

const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));
vi.mock("components/ConfirmDialog", () => ({ confirm: mockConfirm }));

vi.mock("pages/packages/actions", async importOriginal => ({
  ...(await importOriginal()),
  resetBeaconData: id => ({ type: "TEST_RESET_BEACON_DATA", id }),
}));

describe("System > Storage (connected): Free up space", () => {
  it("dispatches the packages resetBeaconData action after the confirm", () => {
    const store = { getState: () => ({}), subscribe: () => () => {}, dispatch: vi.fn() };
    localStorage.setItem("avado.mode", "simple");
    render(
      <Provider store={store}>
        <ModeProvider>
          <MemoryRouter>
            <ConnectedSystemStorage />
          </MemoryRouter>
        </ModeProvider>
      </Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Free up space" }));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(store.dispatch).not.toHaveBeenCalled();
    mockConfirm.mock.calls[0][0].onClick();
    expect(store.dispatch).toHaveBeenCalledWith({ type: "TEST_RESET_BEACON_DATA", id: TEKU });
  });
});
