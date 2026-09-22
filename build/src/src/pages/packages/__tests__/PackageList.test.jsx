import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { getAutoUpdateState, AutoUpdateSwitch } from "pages/packages/components/PackageList";

describe("getAutoUpdateState", () => {
  it("reads the package's own flag, not the manifest's", () => {
    expect(getAutoUpdateState({ autoupdate: false, manifest: { autoupdate: true } })).toBe(false);
    expect(getAutoUpdateState({ autoupdate: true, manifest: { autoupdate: false } })).toBe(true);
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
    const dnp = { name: "grafana.avado.dnp.dappnode.eth", autoupdate: true };
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

    // Redux hasn't pushed the change back yet: stays pending well before the timeout.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(input.checked).toBe(false);
    expect(input).toBeDisabled();

    // The WAMP push lands: redux now agrees with the requested value.
    rerender(<AutoUpdateSwitch dnp={{ ...dnp, autoupdate: false }} title="Grafana" setAutoUpdate={setAutoUpdate} />);
    expect(input.checked).toBe(false);
    expect(input).not.toBeDisabled();
  });

  it("reverts to the redux value after 10s if redux never confirms", () => {
    const setAutoUpdate = vi.fn();
    const dnp = { name: "grafana.avado.dnp.dappnode.eth", autoupdate: true };
    const { getByRole } = render(
      <AutoUpdateSwitch dnp={dnp} title="Grafana" setAutoUpdate={setAutoUpdate} />
    );
    const input = getByRole("checkbox", { name: "Auto-update for Grafana" });

    fireEvent.click(input);
    expect(input.checked).toBe(false);
    expect(input).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(input.checked).toBe(true); // reverted; redux's dnp.autoupdate never changed
    expect(input).not.toBeDisabled();
  });
});
