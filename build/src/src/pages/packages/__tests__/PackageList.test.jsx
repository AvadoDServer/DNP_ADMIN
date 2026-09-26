import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { getAutoUpdateState, AutoUpdateSwitch, AUTOUPDATE_PENDING_TIMEOUT } from "pages/packages/components/PackageList";

describe("getAutoUpdateState", () => {
  // The core only ever sends `manifest.autoupdate` (DAPPMANAGER listPackages),
  // and the dnpInstalled schema has no top-level `autoupdate` key.
  it("reads the core's manifest.autoupdate first", () => {
    expect(getAutoUpdateState({ manifest: { autoupdate: false } })).toBe(false);
    expect(getAutoUpdateState({ manifest: { autoupdate: true } })).toBe(true);
    expect(getAutoUpdateState({ autoupdate: true, manifest: { autoupdate: false } })).toBe(false);
    expect(getAutoUpdateState({ autoupdate: false, manifest: { autoupdate: true } })).toBe(true);
  });

  it("falls back to a top-level flag, and defaults to on", () => {
    expect(getAutoUpdateState({ autoupdate: false, manifest: {} })).toBe(false);
    expect(getAutoUpdateState({ autoupdate: false })).toBe(false);
    expect(getAutoUpdateState({ manifest: {} })).toBe(true);
    expect(getAutoUpdateState({})).toBe(true);
    expect(getAutoUpdateState(null)).toBe(false);
  });
});

describe("AutoUpdateSwitch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the requested value immediately and disables until redux confirms it", () => {
    const setAutoUpdate = vi.fn();
    const dnp = { name: "grafana.avado.dnp.dappnode.eth", manifest: { autoupdate: true } };
    const { getByRole, rerender } = render(
      <AutoUpdateSwitch dnp={dnp} title="Grafana" setAutoUpdate={setAutoUpdate} />
    );
    const input = getByRole("checkbox", { name: "Auto-update for Grafana" });
    expect(input.checked).toBe(true);
    expect(input).not.toBeDisabled();

    fireEvent.click(input);
    expect(setAutoUpdate).toHaveBeenCalledWith("grafana.avado.dnp.dappnode.eth", false);
    expect(input.checked).toBe(false);
    expect(input).toBeDisabled();

    // Redux hasn't pushed the change back yet (the push waits for docker df
    // on the box): still pending well past the old 10 s timeout.
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(input.checked).toBe(false);
    expect(input).toBeDisabled();

    // The WAMP push lands: redux now agrees with the requested value.
    rerender(<AutoUpdateSwitch dnp={{ ...dnp, manifest: { autoupdate: false } }} title="Grafana" setAutoUpdate={setAutoUpdate} />);
    expect(input.checked).toBe(false);
    expect(input).not.toBeDisabled();
  });

  it("reverts to the redux value after 60s if redux never confirms", () => {
    const setAutoUpdate = vi.fn();
    const dnp = { name: "grafana.avado.dnp.dappnode.eth", manifest: { autoupdate: true } };
    const { getByRole } = render(
      <AutoUpdateSwitch dnp={dnp} title="Grafana" setAutoUpdate={setAutoUpdate} />
    );
    const input = getByRole("checkbox", { name: "Auto-update for Grafana" });

    fireEvent.click(input);
    expect(input.checked).toBe(false);
    expect(input).toBeDisabled();

    expect(AUTOUPDATE_PENDING_TIMEOUT).toBe(60000);
    act(() => {
      vi.advanceTimersByTime(AUTOUPDATE_PENDING_TIMEOUT - 1);
    });
    expect(input.checked).toBe(false);
    expect(input).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(input.checked).toBe(true); // reverted; redux's manifest.autoupdate never changed
    expect(input).not.toBeDisabled();
  });
});
