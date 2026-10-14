import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import ReportPanel from "../ReportPanel";
import { ticket0928, healthy, PLANTED_SECRETS } from "health/__tests__/fixtures-diagnostics";

const { saveAs } = vi.hoisted(() => ({ saveAs: vi.fn() }));
vi.mock("file-saver", () => ({ saveAs }));
vi.mock("health/HealthProvider", () => ({
  useHealth: () => ({ allFindings: ticket0928.findings, verdict: ticket0928.verdict, ready: true }),
}));
vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: s => s.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({
  getDappnodeStats: s => s.stats,
  getDappnodeParams: s => s.params,
  getDappmanagerVersionData: s => s.dappmanagerVersionData,
}));
vi.mock("services/chainData/selectors", () => ({ getChainData: s => s.chainData }));
vi.mock("services/userActionLogs/selectors", () => ({ getUserActionLogs: s => s.userActionLogs }));

const stateWith = (packages = ticket0928.packages) => ({
  packages,
  stats: ticket0928.stats,
  params: ticket0928.params,
  chainData: ticket0928.chainData,
  userActionLogs: ticket0928.userActionLogs,
  dappmanagerVersionData: { version: dappmanagerOf(packages).version },
});
const dappmanagerOf = packages => packages.find(p => p.name === "dappmanager.dnp.dappnode.eth");
const renderPanel = (props, state = stateWith()) =>
  render(
    <Provider store={createStore(() => state)}>
      <ReportPanel {...props} />
    </Provider>
  );

// A call the test settles by hand
function deferredCalls() {
  const calls = [];
  const impl = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        calls.push({ resolve, reject });
      })
  );
  return { impl, calls };
}

const showReport = () => fireEvent.click(screen.getByRole("button", { name: "Show what's in it" }));
const reportText = () => document.querySelector("pre").textContent;

describe("ReportPanel", () => {
  beforeEach(() => saveAs.mockClear());

  it("collects box details on open (every probe), then shows the report; Refresh collects again", async () => {
    const { impl, calls } = deferredCalls();
    renderPanel({ fetchDiagnosticsImpl: impl });
    expect(screen.getByRole("status")).toHaveTextContent("Collecting box details…");
    expect(screen.getByRole("button", { name: "Download report" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    await waitFor(() => expect(impl).toHaveBeenCalledTimes(1));
    expect(impl).toHaveBeenCalledWith({});

    await act(async () => calls[0].resolve(ticket0928.diagnostics));
    expect(screen.queryByRole("status")).toBeNull();
    showReport();
    expect(reportText()).toContain("the teku process is not running");
    expect(reportText()).toContain("Checkpoint URL in use: https://sync-mainnet.beaconcha.in");
    for (const s of PLANTED_SECRETS) expect(reportText()).not.toContain(s);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByRole("status")).toHaveTextContent("Collecting box details…");
    await waitFor(() => expect(impl).toHaveBeenCalledTimes(2));
    // Refresh skips the DAPPMANAGER's 20 s cache
    expect(impl).toHaveBeenLastCalledWith({ fresh: true });
    await act(async () => calls[1].resolve(healthy.diagnostics));
    expect(reportText()).toContain("What we found\n- nothing beyond the health findings");
  });

  it("Download saves the full report", async () => {
    renderPanel({ fetchDiagnosticsImpl: async () => ticket0928.diagnostics });
    await waitFor(() => expect(screen.getByRole("button", { name: "Download report" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));
    const blob = saveAs.mock.calls[0][0];
    expect(saveAs.mock.calls[0][1]).toBe("avado-report.txt");
    const text = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(text).toContain("\nProcesses\n");
    expect(text).toContain("\nLogs\n");
  });

  it("Email support keeps the short body", async () => {
    renderPanel({ fetchDiagnosticsImpl: async () => ticket0928.diagnostics });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    const href = screen.getByRole("link", { name: "Email support" }).getAttribute("href");
    const body = decodeURIComponent(href.split("&body=")[1]);
    expect(body).toContain("- [warning] MEV-Boost relays need a look");
    expect(body).not.toContain("teku process");
    expect(href.length).toBeLessThanOrEqual(1800);
  });

  it("a failed call still gives a report that says why", async () => {
    renderPanel({ fetchDiagnosticsImpl: async () => { throw Error("wamp.error.no_such_procedure"); } });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    showReport();
    expect(reportText()).toContain("- Box details: could not be collected: wamp.error.no_such_procedure");
    expect(reportText()).toContain("Teku Consensus Client (teku.avado.dnp.dappnode.eth)");
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    try {
      renderPanel({ fetchDiagnosticsImpl: () => new Promise(() => {}), timeoutMs: 30000 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30001);
      });
      showReport();
      expect(reportText()).toContain("- Box details: could not be collected: timed out after 30 s");
    } finally {
      vi.useRealTimers();
    }
  });

  it("on a Help topic (compact) nothing is collected until Collect box details is pressed; then Refresh", async () => {
    const { impl, calls } = deferredCalls();
    renderPanel({ compact: true, fetchDiagnosticsImpl: impl });
    expect(impl).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Download report" })).not.toBeDisabled();
    showReport();
    expect(reportText()).toContain("- Box details: not collected");

    fireEvent.click(screen.getByRole("button", { name: "Collect box details" }));
    expect(screen.getByRole("status")).toHaveTextContent("Collecting box details…");
    await waitFor(() => expect(impl).toHaveBeenCalledWith({}));
    await act(async () => calls[0].resolve(ticket0928.diagnostics));
    expect(reportText()).toContain("the teku process is not running");
    expect(screen.getByRole("button", { name: "Refresh" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(impl).toHaveBeenCalledTimes(2));
    expect(impl).toHaveBeenLastCalledWith({ fresh: true });
  });

  it("asks a DAPPMANAGER whose own version is 10.0.53 while its image tag says 10.0.52 (a test build)", async () => {
    const fetchDiagnosticsImpl = vi.fn(async () => ticket0928.diagnostics);
    const packages = ticket0928.packages.map(p => (p.name === "dappmanager.dnp.dappnode.eth" ? { ...p, version: "10.0.52" } : p));
    renderPanel({ fetchDiagnosticsImpl }, { ...stateWith(packages), dappmanagerVersionData: { version: "10.0.53" } });
    await waitFor(() => expect(fetchDiagnosticsImpl).toHaveBeenCalledWith({}));
  });

  it("never asks an older DAPPMANAGER: no Refresh, one line under Box", () => {
    const fetchDiagnosticsImpl = vi.fn();
    const packages = ticket0928.packages.map(p => (p.name === "dappmanager.dnp.dappnode.eth" ? { ...p, version: "10.0.52" } : p));
    renderPanel({ fetchDiagnosticsImpl }, stateWith(packages));
    expect(fetchDiagnosticsImpl).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    showReport();
    expect(reportText()).toContain("- Box details need DAPPMANAGER 10.0.53 or newer");
  });
});
