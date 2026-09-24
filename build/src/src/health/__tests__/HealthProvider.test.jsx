import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
  loadingStatus: { dnpInstalled: { isLoading: false, isLoaded: true } },
};

// `state.packages` has no remoteconnect/vpn package, so `remote-access-missing`
// (dismissable: true) and `consensus-without-execution:mainnet` (a critical,
// non-dismissable finding, since nimbus has no execution client) both fire
// against this fixture regardless of the store/metrics impls passed in.

function Probe({ dismissId }) {
  const { verdict, findings, allFindings, sources, dismiss, checksPassed, checksTotal, ready, metrics } = useHealth();
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
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
      <span data-testid="metrics">{metrics ? JSON.stringify(metrics) : "null"}</span>
    </div>
  );
}

const renderWith = (props, probeProps, stateOverride) =>
  render(
    <Provider store={createStore(() => stateOverride || state)}>
      <HealthProvider fetchFeeRecipientsImpl={async () => null} {...props}>
        <Probe {...probeProps} />
      </HealthProvider>
    </Provider>
  );

beforeEach(() => {
  localStorage.clear();
});

describe("HealthProvider", () => {
  it("feeds update ages into the rules and makes no keymanager request from the browser", async () => {
    localStorage.setItem("avado.updateAges", JSON.stringify({ "nimbus.avado.dnp.dappnode.eth": Date.now() - 3 * 24 * 3600 * 1000 }));
    const feeCalls = [];
    renderWith({
      fetchStoreImpl: async () => ({ packages: [{ manifest: { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.49" } }] }),
      fetchMetricsImpl: async () => null,
      fetchFeeRecipientsImpl: async (...args) => {
        feeCalls.push(args);
        return { "nimbus.avado.dnp.dappnode.eth": { validators: 2, checked: 2, missing: 1 } };
      },
    });
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("update-blocked:nimbus.avado.dnp.dappnode.eth"));
    // Nimbus runs, but no validator client is readable from http://my.ava.do (CORS): nothing is fetched
    expect(feeCalls).toEqual([]);
    expect(screen.getByTestId("allids").textContent).not.toContain("fee-recipient-missing");
    // the first-seen time is kept, not reset
    const ages = JSON.parse(localStorage.getItem("avado.updateAges"));
    expect(Date.now() - ages["nimbus.avado.dnp.dappnode.eth"]).toBeGreaterThan(2 * 24 * 3600 * 1000);
  });

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

  it("flags metrics-unavailable when Prometheus runs but the scrape fails", async () => {
    const withPrometheus = {
      ...state,
      packages: [...state.packages, { name: "prometheus.avado.dappnode.eth", version: "1.0.0", state: "running", running: true, manifest: { title: "Prometheus" } }],
    };
    renderWith(
      { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null },
      undefined,
      withPrometheus
    );
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("metrics-unavailable"));
  });

  it("ready is true once dnpInstalled has loaded", async () => {
    renderWith({
      fetchStoreImpl: async () => ({ packages: [] }),
      fetchMetricsImpl: async () => null,
    });
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
  });

  it("exposes the installed `packages` and `chainData` (Home's chain strip reads them)", async () => {
    function PkgProbe() {
      const { packages, chainData } = useHealth();
      return (
        <span data-testid="pkgs">
          {(packages || []).map(p => p.name).join(",")}|{Array.isArray(chainData) ? "chain-array" : "chain-missing"}
        </span>
      );
    }
    render(
      <Provider store={createStore(() => state)}>
        <HealthProvider fetchStoreImpl={async () => ({ packages: [] })} fetchMetricsImpl={async () => null}>
          <PkgProbe />
        </HealthProvider>
      </Provider>
    );
    expect(screen.getByTestId("pkgs").textContent).toBe("nimbus.avado.dnp.dappnode.eth|chain-array");
  });

  it("exposes the raw Prometheus samples as `metrics`, null while monitoring isn't running", async () => {
    renderWith({
      fetchStoreImpl: async () => ({ packages: [] }),
      fetchMetricsImpl: async () => null,
    });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    // `state` (module scope) has no prometheus package installed, so metrics
    // is never fetched at all and stays null — not an empty object.
    expect(screen.getByTestId("metrics").textContent).toBe("null");
  });

  it("exposes `metrics` once Prometheus is installed and the scrape succeeds", async () => {
    const withPrometheus = {
      ...state,
      packages: [...state.packages, { name: "prometheus.avado.dappnode.eth", version: "1.0.0", state: "running", running: true, manifest: { title: "Prometheus" } }],
    };
    const headSlot = [{ client: "nimbus", network: "mainnet", value: 15273292 }];
    renderWith(
      { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => ({ headSlot, peers: [] }) },
      undefined,
      withPrometheus
    );
    await waitFor(() => expect(screen.getByTestId("metrics").textContent).toContain("15273292"));
    expect(JSON.parse(screen.getByTestId("metrics").textContent)).toEqual({ headSlot, peers: [] });
  });
});

describe("HealthProvider readiness", () => {
  const okStore = { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null };

  // On a real box `dnpInstalled` usually arrives via a WAMP push, which never
  // touches the loadingStatus reducer at all — so `isLoaded` can stay false
  // forever even once packages are genuinely present. Ready must not depend
  // on that flag alone.
  it("is ready once packages have arrived, even if dnpInstalled's own isLoaded flag never fires", async () => {
    renderWith(okStore, undefined, { ...state, loadingStatus: { dnpInstalled: { isLoading: true, isLoaded: false } } });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ready").textContent).toBe("true");
    // And findings are actually computed, not just the flag flipped.
    expect(screen.getByTestId("ids").textContent).not.toBe("");
  });

  it("is ready once dnpInstalled loading has errored, even with no packages yet — diagnoses can still explain why", async () => {
    const errored = {
      ...state,
      packages: [],
      loadingStatus: { dnpInstalled: { isLoading: false, isLoaded: false, error: "RPC refused to connect" } },
    };
    renderWith(okStore, undefined, errored);
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ready").textContent).toBe("true");
  });

  it("is not ready when there are no packages yet, dnpInstalled hasn't loaded, and there's no error", async () => {
    const nothingYet = { ...state, packages: [], loadingStatus: { dnpInstalled: { isLoading: true, isLoaded: false } } };
    renderWith(okStore, undefined, nothingYet);
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(screen.getByTestId("allids").textContent).toBe("");
    expect(screen.getByTestId("checksPassed").textContent).toBe("0");
    expect(screen.getByTestId("checksTotal").textContent).toBe("0");
  });

  it("is not ready when the loadingStatus slice itself is missing and there are no packages yet", async () => {
    const stateWithoutLoadingStatus = { packages: [], stats: state.stats, params: state.params };
    renderWith(okStore, undefined, stateWithoutLoadingStatus);
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(screen.getByTestId("ids").textContent).toBe("");
  });
});

describe("HealthProvider: nodeid never arrives", () => {
  it("gives up on the store fetch after ~20s and marks sources.updates failed, instead of 'loading' forever", async () => {
    vi.useFakeTimers();
    try {
      const noNodeid = { ...state, params: {} };
      renderWith(
        { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null },
        undefined,
        noNodeid
      );
      expect(screen.getByTestId("updates").textContent).toBe("loading");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });

      expect(screen.getByTestId("updates").textContent).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not force a failure after 20s when nodeid is present from the start and the fetch already succeeded", async () => {
    vi.useFakeTimers();
    try {
      renderWith(
        { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null },
        undefined,
        state // has params.nodeid set, so the give-up timer is never even started
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(screen.getByTestId("updates").textContent).toBe("ok");
    } finally {
      vi.useRealTimers();
    }
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

describe("HealthProvider metricsFetchedAt", () => {
  function FetchedAtProbe() {
    const { metricsFetchedAt } = useHealth();
    return <span data-testid="fetchedAt">{metricsFetchedAt ? String(metricsFetchedAt.getTime()) : "null"}</span>;
  }

  it("is null without metrics and records when the Prometheus sample was fetched", async () => {
    const withPrometheus = {
      ...state,
      packages: [...state.packages, { name: "prometheus.avado.dappnode.eth", version: "1.0.0", state: "running", running: true, manifest: { title: "Prometheus" } }],
    };
    const before = Date.now();
    render(
      <Provider store={createStore(() => withPrometheus)}>
        <HealthProvider fetchStoreImpl={async () => ({ packages: [] })} fetchMetricsImpl={async () => ({ headSlot: [], peers: [] })}>
          <FetchedAtProbe />
        </HealthProvider>
      </Provider>
    );
    expect(screen.getByTestId("fetchedAt").textContent).toBe("null");
    await waitFor(() => expect(screen.getByTestId("fetchedAt").textContent).not.toBe("null"));
    const at = Number(screen.getByTestId("fetchedAt").textContent);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});
