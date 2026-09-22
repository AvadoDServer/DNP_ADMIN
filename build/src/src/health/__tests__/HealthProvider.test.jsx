import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { HealthProvider, useHealth } from "health/HealthProvider";

vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: s => s.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({ getDappnodeStats: s => s.stats, getDappnodeParams: s => s.params }));
vi.mock("services/chainData/selectors", () => ({ getChainData: () => [] }));
vi.mock("services/coreUpdate/selectors", () => ({ getCoreUpdateAvailable: () => false }));
vi.mock("pages/troubleshoot/selectors", () => ({ getDiagnoses: () => [] }));

const state = {
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48", state: "running", running: true, manifest: { title: "Nimbus" } }],
  stats: { disk: "12%" },
  params: { nodeid: "0xabc" },
};

// `state.packages` has no remoteconnect/vpn package, so `remote-access-missing`
// (dismissable: true) and `consensus-without-execution:mainnet` (a critical,
// non-dismissable finding, since nimbus has no execution client) both fire
// against this fixture regardless of the store/metrics impls passed in.

function Probe({ dismissId }) {
  const { verdict, findings, allFindings, sources, dismiss, checksPassed, checksTotal } = useHealth();
  return (
    <div>
      <span data-testid="verdict">{verdict.label}</span>
      <span data-testid="ids">{findings.map(f => f.id).join(",")}</span>
      <span data-testid="allids">{allFindings.map(f => f.id).join(",")}</span>
      <span data-testid="updates">{sources.updates}</span>
      {dismissId && (
        <button data-testid="dismiss-btn" onClick={() => dismiss(dismissId)}>
          dismiss
        </button>
      )}
      <span data-testid="checksPassed">{checksPassed}</span>
      <span data-testid="checksTotal">{checksTotal}</span>
    </div>
  );
}

const renderWith = (props, probeProps) =>
  render(
    <Provider store={createStore(() => state)}>
      <HealthProvider {...props}>
        <Probe {...probeProps} />
      </HealthProvider>
    </Provider>
  );

beforeEach(() => {
  localStorage.clear();
});

describe("HealthProvider", () => {
  it("combines redux state, store updates and metrics into findings", async () => {
    renderWith({
      fetchStoreImpl: async () => ({ packages: [{ manifest: { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.49" } }] }),
      fetchMetricsImpl: async () => null,
    });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("verdict").textContent).toBe("Action required");
    expect(screen.getByTestId("ids").textContent).toContain("consensus-without-execution:mainnet");
    expect(screen.getByTestId("ids").textContent).toContain("updates-available");
    const passed = Number(screen.getByTestId("checksPassed").textContent);
    const total = Number(screen.getByTestId("checksTotal").textContent);
    expect(Number.isFinite(passed)).toBe(true);
    expect(Number.isFinite(total)).toBe(true);
    expect(passed).toBeLessThanOrEqual(total);
  });

  it("useHealth store failure: marks updates failed and still renders", async () => {
    renderWith({ fetchStoreImpl: async () => { throw Error("offline"); }, fetchMetricsImpl: async () => null });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("failed"));
    expect(screen.getByTestId("ids").textContent).toContain("store-unreachable");
  });
});

describe("HealthProvider dismissals", () => {
  const okStore = { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null };

  it("dismiss removes a dismissable info finding from findings but keeps it in allFindings", async () => {
    renderWith(okStore, { dismissId: "remote-access-missing" });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ids").textContent).toContain("remote-access-missing");

    fireEvent.click(screen.getByTestId("dismiss-btn"));

    await waitFor(() => expect(screen.getByTestId("ids").textContent).not.toContain("remote-access-missing"));
    expect(screen.getByTestId("allids").textContent).toContain("remote-access-missing");
  });

  it("persists the dismissal: a fresh render (e.g. after reload) still hides it", async () => {
    const first = renderWith(okStore, { dismissId: "remote-access-missing" });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    fireEvent.click(screen.getByTestId("dismiss-btn"));
    await waitFor(() => expect(screen.getByTestId("ids").textContent).not.toContain("remote-access-missing"));
    first.unmount();

    renderWith(okStore);
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ids").textContent).not.toContain("remote-access-missing");
  });

  it("never hides a critical, non-dismissable finding even if dismiss is called on its id", async () => {
    renderWith(okStore, { dismissId: "consensus-without-execution:mainnet" });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ids").textContent).toContain("consensus-without-execution:mainnet");

    fireEvent.click(screen.getByTestId("dismiss-btn"));

    await waitFor(() => expect(screen.getByTestId("verdict").textContent).toBe("Action required"));
    expect(screen.getByTestId("ids").textContent).toContain("consensus-without-execution:mainnet");
  });
});
