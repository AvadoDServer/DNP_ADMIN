import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { HealthProvider, useHealth } from "health/HealthProvider";
import { ALL_RULES } from "health/rules";
import { coreUpdateAvailable } from "health/rules/updates";
import { feeRecipientMissing } from "health/rules/validators";
import { headBehind, lowPeers, missedAttestations } from "health/rules/chain";
import { diskFillingUp } from "health/rules/storage";
import { lostData } from "health/rules/lostData";
import { ipfsRestarting } from "health/rules/ipfs";
import { fetchDiskTrend, DISK_QUERIES, resetPrometheusBase } from "health/prometheus";

vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: s => s.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({ getDappnodeStats: s => s.stats, getDappnodeParams: s => s.params }));
vi.mock("services/chainData/selectors", () => ({ getChainData: () => [] }));
vi.mock("services/coreUpdate/selectors", () => ({ getCoreUpdateAvailable: s => Boolean(s.coreUpdateAvailable) }));
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

function Probe({ dismissId, withUndismissAll }) {
  const { verdict, findings, allFindings, sources, dismiss, undismissAll, checksPassed, checksTotal, ready, metrics, refreshLostData } = useHealth();
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
      {withUndismissAll && (
        <button data-testid="undismiss-all-btn" onClick={() => undismissAll()}>
          show hidden
        </button>
      )}
      <span data-testid="checksPassed">{checksPassed}</span>
      <span data-testid="checksTotal">{checksTotal}</span>
      <span data-testid="metrics">{metrics ? JSON.stringify(metrics) : "null"}</span>
      <button data-testid="refresh-lost-data" onClick={() => refreshLostData()}>
        scan again
      </button>
      <button data-testid="force-lost-data" onClick={() => refreshLostData({ force: true })}>
        scan now
      </button>
    </div>
  );
}

const renderWith = (props, probeProps, stateOverride) =>
  render(
    <Provider store={createStore(() => stateOverride || state)}>
      <HealthProvider
        fetchFeeRecipientsImpl={async () => null}
        fetchCareStatusImpl={async () => ({ findings: [] })}
        fetchDiskTrendImpl={async () => null}
        fetchLostDataImpl={async () => []}
        {...props}
      >
        <Probe {...probeProps} />
      </HealthProvider>
    </Provider>
  );

beforeEach(() => {
  localStorage.clear();
});

describe("HealthProvider", () => {
  const withCare = {
    ...state,
    packages: [...state.packages, { name: "care.avado.dnp.dappnode.eth", version: "0.1.0", state: "running", running: true, manifest: { title: "AVADO Care" } }],
  };
  const careStatus = {
    findings: [
      { id: "fee-recipient-missing:nimbus.avado.dnp.dappnode.eth", severity: "critical", topic: "setup", title: "Validators in Nimbus have no fee recipient", why: "Fees are lost." },
      { id: "disk-high", severity: "critical", topic: "storage", title: "Your disk is 99% full", why: "" },
    ],
  };

  it("shows AVADO Care's fee-recipient finding while Care runs (and nothing else from Care)", async () => {
    let calls = 0;
    renderWith(
      { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null, fetchCareStatusImpl: async () => (calls++, careStatus) },
      {},
      withCare
    );
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("fee-recipient-missing:nimbus.avado.dnp.dappnode.eth"));
    expect(screen.getByTestId("ids").textContent).not.toContain("disk-high");
    expect(screen.getByTestId("verdict").textContent).toBe("Action required");
    expect(calls).toBe(1);
  });

  it("without Care, or when its status can't be read, nothing changes", async () => {
    let calls = 0;
    renderWith({ fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null, fetchCareStatusImpl: async () => (calls++, careStatus) });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(calls).toBe(0);
    expect(screen.getByTestId("ids").textContent).not.toContain("fee-recipient-missing");
  });

  it("an unreadable Care status adds nothing", async () => {
    renderWith(
      { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null, fetchCareStatusImpl: async () => { throw Error("502"); } },
      {},
      withCare
    );
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ids").textContent).not.toContain("fee-recipient-missing");
  });

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

  it("counts only checks that really ran: no core-update check, no metrics, no fee recipients", async () => {
    renderWith({ fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    // Nothing checked for a system update, Prometheus isn't installed (no
    // chain metrics, no disk forecast), and no validator client is readable
    // from the browser: these never count.
    // Nor can the DAPPMANAGER (none in this list) look for lost data or
    // report on IPFS.
    const skipped = [coreUpdateAvailable, feeRecipientMissing, headBehind, lowPeers, missedAttestations, diskFillingUp, lostData, ipfsRestarting];
    const total = Number(screen.getByTestId("checksTotal").textContent);
    const passed = Number(screen.getByTestId("checksPassed").textContent);
    expect(total).toBe(ALL_RULES.length - skipped.length);
    expect(passed).toBeLessThan(total);
  });

  it("counts and runs the core-update check once an update is reported", async () => {
    renderWith(
      { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null },
      undefined,
      { ...state, coreUpdateAvailable: true }
    );
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("ids").textContent).toContain("core-update-available");
  });

  it("a partial Prometheus answer is not 'metrics unavailable'; only the checks with data run", async () => {
    const withPrometheus = {
      ...state,
      packages: [...state.packages, { name: "prometheus.avado.dappnode.eth", version: "1.0.0", state: "running", running: true, manifest: { title: "Prometheus" } }],
    };
    const partial = { headSlot: [{ client: "nimbus", network: "mainnet", value: 15273292 }], peers: null, attesterMiss: [], attesterHit: [] };
    renderWith(
      { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => partial },
      undefined,
      withPrometheus
    );
    await waitFor(() => expect(screen.getByTestId("metrics").textContent).toContain("15273292"));
    expect(screen.getByTestId("allids").textContent).not.toContain("metrics-unavailable");
    // headBehind runs (it has samples); lowPeers (failed) and missedAttestations (no samples) don't,
    // nor the disk forecast (no disk trend).
    const skipped = [coreUpdateAvailable, feeRecipientMissing, lowPeers, missedAttestations, diskFillingUp, lostData, ipfsRestarting];
    expect(Number(screen.getByTestId("checksTotal").textContent)).toBe(ALL_RULES.length - skipped.length);
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

  it("undismissAll brings a hidden tip back at once, without refetching anything", async () => {
    const fetchStoreImpl = vi.fn(async () => ({ packages: [] }));
    renderWith({ ...okStore, fetchStoreImpl }, { dismissId: "remote-access-missing", withUndismissAll: true });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    fireEvent.click(screen.getByTestId("dismiss-btn"));
    await waitFor(() => expect(screen.getByTestId("ids").textContent).not.toContain("remote-access-missing"));
    const storeCalls = fetchStoreImpl.mock.calls.length;

    fireEvent.click(screen.getByTestId("undismiss-all-btn"));

    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("remote-access-missing"));
    expect(JSON.parse(localStorage.getItem("avado.dismissedFindings"))).toEqual([]);
    // Not refresh(): that would refetch the store before anything re-rendered.
    expect(fetchStoreImpl).toHaveBeenCalledTimes(storeCalls);
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
        <HealthProvider
          fetchStoreImpl={async () => ({ packages: [] })}
          fetchMetricsImpl={async () => ({ headSlot: [], peers: [] })}
          fetchDiskTrendImpl={async () => null}
        >
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

describe("HealthProvider disk forecast", () => {
  const prometheus = { name: "prometheus.avado.dappnode.eth", version: "1.0.0", state: "running", running: true, manifest: { title: "Prometheus" } };
  const withPrometheus = { ...state, packages: [...state.packages, prometheus] };
  const DAY = 86400;
  // 300 GB free, filling 15 GB a day by every measure: full in about 20 days.
  const filling = { free: 300e9, slope7d: -15e9 / DAY, slope2d: -14e9 / DAY, slopeHourly: -16e9 / DAY, slopeRecent: -15e9 / DAY, hoursOfData: 168 };

  function DiskProbe() {
    const { diskForecast, diskTrendStatus, metrics, findings, stats } = useHealth();
    return (
      <div>
        <span data-testid="state">{diskForecast.state}</span>
        <span data-testid="status">{diskTrendStatus}</span>
        <span data-testid="metrics">{metrics ? JSON.stringify(metrics) : "null"}</span>
        <span data-testid="ids">{findings.map(f => f.id).join(",")}</span>
        <span data-testid="disk">{stats.disk}</span>
      </div>
    );
  }

  const renderDisk = (props, stateOverride = withPrometheus) =>
    render(
      <Provider store={createStore(() => stateOverride)}>
        <HealthProvider
          fetchStoreImpl={async () => ({ packages: [] })}
          fetchFeeRecipientsImpl={async () => null}
          fetchCareStatusImpl={async () => ({ findings: [] })}
          {...props}
        >
          <DiskProbe />
        </HealthProvider>
      </Provider>
    );

  it("fetches the disk trend while Prometheus runs and raises disk-filling-up from it", async () => {
    const fetchDiskTrendImpl = vi.fn(async () => filling);
    renderDisk({ fetchMetricsImpl: async () => null, fetchDiskTrendImpl });
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("filling"));
    expect(screen.getByTestId("status").textContent).toBe("ok");
    expect(screen.getByTestId("ids").textContent).toContain("disk-filling-up");
    expect(screen.getByTestId("disk").textContent).toBe("12%");
    expect(fetchDiskTrendImpl).toHaveBeenCalledTimes(1);
  });

  it("does not ask for the disk trend while Prometheus isn't running", async () => {
    const fetchDiskTrendImpl = vi.fn(async () => filling);
    renderDisk({ fetchMetricsImpl: async () => null, fetchDiskTrendImpl }, state);
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("consensus-without-execution"));
    expect(fetchDiskTrendImpl).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("none");
    expect(screen.getByTestId("status").textContent).toBe("not-installed");
  });

  it("a failing disk query never blanks the chain metrics", async () => {
    const headSlot = [{ client: "nimbus", network: "mainnet", value: 15273292 }];
    renderDisk({
      fetchMetricsImpl: async () => ({ headSlot, peers: [], attesterMiss: [], attesterHit: [] }),
      fetchDiskTrendImpl: async () => {
        throw Error("disk query timed out");
      },
    });
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("failed"));
    await waitFor(() => expect(screen.getByTestId("metrics").textContent).toContain("15273292"));
    expect(screen.getByTestId("ids").textContent).not.toContain("metrics-unavailable");
    expect(screen.getByTestId("state").textContent).toBe("none");
  });

  it("failed chain metrics don't take the disk forecast down either", async () => {
    renderDisk({ fetchMetricsImpl: async () => null, fetchDiskTrendImpl: async () => filling });
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("filling"));
    expect(screen.getByTestId("ids").textContent).toContain("metrics-unavailable");
    expect(screen.getByTestId("ids").textContent).toContain("disk-filling-up");
  });

  it("a failed read keeps the last good trend for up to an hour, so a disk finding doesn't come and go", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetchDiskTrendImpl = async () => {
        calls++;
        if (calls === 1) return filling;
        throw Error("timeout");
      };
      renderDisk({ fetchMetricsImpl: async () => null, fetchDiskTrendImpl });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("state").textContent).toBe("filling");
      // Reads at 10..50 minutes fail: the trend from minute 0 still counts.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50 * 60 * 1000);
      });
      expect(calls).toBe(6);
      expect(screen.getByTestId("status").textContent).toBe("failed");
      expect(screen.getByTestId("state").textContent).toBe("filling");
      expect(screen.getByTestId("ids").textContent).toContain("disk-filling-up");
      // At 60 minutes it is too old.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });
      expect(screen.getByTestId("state").textContent).toBe("none");
      expect(screen.getByTestId("ids").textContent).not.toContain("disk-filling-up");
    } finally {
      vi.useRealTimers();
    }
  });

  it("one failed disk query (of six) keeps the last good trend too, instead of 'no forecast'", async () => {
    // The real fetchDiskTrend over a fake Prometheus: the first read answers
    // everything, later reads lose only the hourly-median query.
    resetPrometheusBase();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      let reads = 0;
      const answer = value => ({
        ok: true,
        json: async () => ({ status: "success", data: { resultType: "vector", result: [{ metric: {}, value: [0, String(value)] }] } }),
      });
      const fetchImpl = async url => {
        const key = Object.keys(DISK_QUERIES).find(k => url.includes(encodeURIComponent(DISK_QUERIES[k])));
        if (reads > 1 && key === "slopeHourly") return { ok: false, json: async () => ({}) };
        return answer(filling[key]);
      };
      const fetchDiskTrendImpl = () => {
        reads++;
        return fetchDiskTrend(fetchImpl);
      };
      renderDisk({ fetchMetricsImpl: async () => null, fetchDiskTrendImpl });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("state").textContent).toBe("filling");
      expect(screen.getByTestId("status").textContent).toBe("ok");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });
      expect(reads).toBe(2);
      expect(screen.getByTestId("status").textContent).toBe("failed");
      expect(screen.getByTestId("state").textContent).toBe("filling");
      expect(screen.getByTestId("ids").textContent).toContain("disk-filling-up");
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
      resetPrometheusBase();
    }
  });

  it("the disk forecast folds into disk-high instead of a second disk finding", async () => {
    renderDisk(
      { fetchMetricsImpl: async () => null, fetchDiskTrendImpl: async () => filling },
      { ...withPrometheus, stats: { disk: "85%" } }
    );
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("filling"));
    const ids = screen.getByTestId("ids").textContent.split(",");
    expect(ids).toContain("disk-high");
    expect(ids).not.toContain("disk-filling-up");
  });
});

describe("HealthProvider lost data", () => {
  const RP = "rocketpool.avado.dnp.dappnode.eth";
  const withDappmanager = version => ({
    ...state,
    packages: [
      ...state.packages,
      { name: "dappmanager.dnp.dappnode.eth", isCore: true, version, state: "running", running: true },
      { name: RP, version: "1.0.0", state: "running", running: true, manifest: { title: "Rocket Pool" } },
    ],
  });
  const lost = [{ package: RP, live: [], candidates: [{ name: "old_rocketpool", anonymous: false, createdAt: null, entries: ["data"], sizeKb: 4, target: "new_rocketpool" }] }];
  const base = { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null };

  it("asks a DAPPMANAGER of 10.0.51 and shows a finding per volume", async () => {
    const fetchLostDataImpl = vi.fn(async () => lost);
    renderWith({ ...base, fetchLostDataImpl }, {}, withDappmanager("10.0.51"));
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain(`lost-data:${RP}:old_rocketpool`));
    expect(fetchLostDataImpl).toHaveBeenCalledTimes(1);
  });

  it("never asks an older DAPPMANAGER, and the check does not count", async () => {
    const fetchLostDataImpl = vi.fn(async () => lost);
    renderWith({ ...base, fetchLostDataImpl }, {}, withDappmanager("10.0.50"));
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(fetchLostDataImpl).not.toHaveBeenCalled();
    expect(screen.getByTestId("allids").textContent).not.toContain("lost-data");
  });

  it("a failed read leaves one debug line and no finding", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const error = vi.spyOn(console, "error");
    try {
      renderWith({ ...base, fetchLostDataImpl: async () => { throw Error("wamp.error.no_such_procedure"); } }, {}, withDappmanager("10.0.51"));
      await waitFor(() => expect(debug).toHaveBeenCalledTimes(1));
      expect(debug.mock.calls[0][0]).toContain("no_such_procedure");
      expect(error).not.toHaveBeenCalled();
      expect(screen.getByTestId("allids").textContent).not.toContain("lost-data");
    } finally {
      debug.mockRestore();
      error.mockRestore();
    }
  });

  it("Home's refreshLostData scans again, but not within 30 seconds of the last scan", async () => {
    const fetchLostDataImpl = vi.fn(async () => []);
    const now = vi.spyOn(Date, "now");
    let t = 1_000_000;
    now.mockImplementation(() => t);
    try {
      renderWith({ ...base, fetchLostDataImpl }, {}, withDappmanager("10.0.51"));
      await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(1));
      t += 10 * 1000;
      fireEvent.click(screen.getByTestId("refresh-lost-data"));
      await act(async () => {});
      expect(fetchLostDataImpl).toHaveBeenCalledTimes(1);
      t += 30 * 1000;
      fireEvent.click(screen.getByTestId("refresh-lost-data"));
      await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(2));
    } finally {
      now.mockRestore();
    }
  });

  it("never runs two scans at once: the interval, Check again and Home wait for the running one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = vi.spyOn(Date, "now");
    let t = 1_000_000;
    now.mockImplementation(() => t);
    let finish;
    const fetchLostDataImpl = vi.fn(() => new Promise(resolve => (finish = resolve)));
    try {
      renderWith({ ...base, fetchLostDataImpl }, {}, withDappmanager("10.0.51"));
      await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(1));
      t += 11 * 60 * 1000;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });
      fireEvent.click(screen.getByTestId("refresh-lost-data"));
      await act(async () => {});
      expect(fetchLostDataImpl).toHaveBeenCalledTimes(1);
      await act(async () => finish(lost));
      await waitFor(() => expect(screen.getByTestId("allids").textContent).toContain("lost-data:"));
      fireEvent.click(screen.getByTestId("refresh-lost-data"));
      await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(2));
      await act(async () => finish([]));
    } finally {
      now.mockRestore();
      vi.useRealTimers();
    }
  });

  it("refreshLostData({ force: true }) scans at once, or right after the running scan", async () => {
    let finish;
    const fetchLostDataImpl = vi.fn(() => new Promise(resolve => (finish = resolve)));
    renderWith({ ...base, fetchLostDataImpl }, {}, withDappmanager("10.0.51"));
    await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(1));
    // Within 30 s and while the first scan runs: queued, not run alongside it
    fireEvent.click(screen.getByTestId("force-lost-data"));
    await act(async () => {});
    expect(fetchLostDataImpl).toHaveBeenCalledTimes(1);
    await act(async () => finish(lost));
    await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(2));
    await act(async () => finish([]));
    await waitFor(() => expect(screen.getByTestId("allids").textContent).not.toContain("lost-data:"));
    // No scan running, last one a moment ago: runs at once
    fireEvent.click(screen.getByTestId("force-lost-data"));
    await waitFor(() => expect(fetchLostDataImpl).toHaveBeenCalledTimes(3));
    await act(async () => finish([]));
  });
});


describe("HealthProvider IPFS health", () => {
  const IPFS = "ipfs.dnp.dappnode.eth";
  const withDappmanager = version => ({
    ...state,
    packages: [
      ...state.packages,
      { name: "dappmanager.dnp.dappnode.eth", isCore: true, version, state: "running", running: true },
      { name: IPFS, isCore: true, version: "10.0.7", state: "restarting", running: true, manifest: { title: "AVADO IPFS node" } },
    ],
  });
  const restarting = { exists: true, running: false, restarting: true, restartCount: 9, restartsLastHour: 5, startedAt: null, lastLogLines: ["Error: corrupted"], resetRunning: false };
  const base = { fetchStoreImpl: async () => ({ packages: [] }), fetchMetricsImpl: async () => null };

  it("asks a DAPPMANAGER of 10.0.52 and shows 'IPFS keeps restarting' instead of the generic finding", async () => {
    const fetchIpfsHealthImpl = vi.fn(async () => restarting);
    renderWith({ ...base, fetchIpfsHealthImpl }, {}, withDappmanager("10.0.52"));
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("ipfs-restarting"));
    expect(screen.getByTestId("ids").textContent).not.toContain(`app-restarting:${IPFS}`);
    expect(fetchIpfsHealthImpl).toHaveBeenCalledTimes(1);
  });

  it("never asks an older DAPPMANAGER: the generic 'keeps restarting' finding stays", async () => {
    const fetchIpfsHealthImpl = vi.fn(async () => restarting);
    renderWith({ ...base, fetchIpfsHealthImpl }, {}, withDappmanager("10.0.51"));
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(fetchIpfsHealthImpl).not.toHaveBeenCalled();
    expect(screen.getByTestId("allids").textContent).toContain(`app-restarting:${IPFS}`);
    expect(screen.getByTestId("allids").textContent).not.toContain("ipfs-restarting");
  });

  it("no IPFS container at all: the finding still shows (IPFS is missing)", async () => {
    const fetchIpfsHealthImpl = vi.fn(async () => ({ ...restarting, exists: false, running: false, restarting: false, lastLogLines: [] }));
    renderWith({ ...base, fetchIpfsHealthImpl }, {}, withDappmanager("10.0.52"));
    await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("ipfs-restarting"));
  });

  it("a failed read leaves a debug line and no finding", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      renderWith({ ...base, fetchIpfsHealthImpl: async () => { throw Error("wamp.error.no_such_procedure"); } }, {}, withDappmanager("10.0.52"));
      await waitFor(() => expect(debug).toHaveBeenCalled());
      expect(debug.mock.calls.map(c => c[0]).join(" ")).toContain("getIpfsHealth failed");
      expect(screen.getByTestId("allids").textContent).not.toContain("ipfs-restarting");
    } finally {
      debug.mockRestore();
    }
  });
});
