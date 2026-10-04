import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PackageControls } from "pages/packages/components/PackageViews/Controls";

const mockConfirmStop = vi.fn();
vi.mock("pages/packages/components/confirmStopPackage", () => ({
  default: (...args) => mockConfirmStop(...args),
}));

const mockConfirmBeacon = vi.fn();
vi.mock("pages/packages/components/confirmResetBeaconData", () => ({
  default: (...args) => mockConfirmBeacon(...args),
}));

const togglePackage = vi.fn();

const baseProps = {
  togglePackage,
  restartPackage: vi.fn(),
  restartPackageVolumes: vi.fn(),
  resyncPackage: vi.fn(),
  removePackage: vi.fn(),
  showReset: true,
  showRemove: true,
  history: { push: vi.fn() },
};

beforeEach(() => {
  mockConfirmStop.mockClear();
  togglePackage.mockClear();
});

describe("PackageControls toggle action (Overview tab)", () => {
  it('Pause (a running, non-core package) confirms first, via confirmStopPackage — does not toggle directly', () => {
    const dnp = { name: "nimbus.avado.dnp.dappnode.eth", state: "running", manifest: { title: "Nimbus" } };
    render(<PackageControls {...baseProps} dnp={dnp} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(mockConfirmStop).toHaveBeenCalledWith(dnp.name, togglePackage, "Nimbus");
    expect(togglePackage).not.toHaveBeenCalled();
  });

  it("Start (a stopped, non-core package) toggles immediately, no confirm", () => {
    const dnp = { name: "nimbus.avado.dnp.dappnode.eth", state: "exited", manifest: { title: "Nimbus" } };
    render(<PackageControls {...baseProps} dnp={dnp} isCore={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(togglePackage).toHaveBeenCalledWith(dnp.name);
    expect(mockConfirmStop).not.toHaveBeenCalled();
  });

  it("hides Pause entirely for a running core package", () => {
    const dnp = { name: "ipfs.dnp.dappnode.eth", state: "running", isCore: true, manifest: { title: "IPFS" } };
    render(<PackageControls {...baseProps} dnp={dnp} isCore={true} />);
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });

  it("still offers Start for a stopped core package (not destructive)", () => {
    const dnp = { name: "ipfs.dnp.dappnode.eth", state: "exited", isCore: true, manifest: { title: "IPFS" } };
    render(<PackageControls {...baseProps} dnp={dnp} isCore={true} />);
    const button = screen.getByRole("button", { name: "Start" });
    fireEvent.click(button);
    expect(togglePackage).toHaveBeenCalledWith(dnp.name);
    expect(mockConfirmStop).not.toHaveBeenCalled();
  });
});

describe("PackageControls Free up space row", () => {
  const dm = version => ({ name: "dappmanager.dnp.dappnode.eth", version, isCore: true });
  const teku = { name: "teku.avado.dnp.dappnode.eth", state: "running", manifest: { title: "Teku" } };
  const resetBeaconData = vi.fn();

  it("shows for a consensus client with DAPPMANAGER 10.0.50 and opens the confirm", () => {
    render(<PackageControls {...baseProps} resetBeaconData={resetBeaconData} packages={[teku, dm("10.0.50")]} dnp={teku} isCore={false} />);
    expect(screen.getByText(/Deletes only the chain data and downloads a recent checkpoint/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Free up space" }));
    expect(mockConfirmBeacon).toHaveBeenCalledWith(teku, resetBeaconData);
    expect(resetBeaconData).not.toHaveBeenCalled();
  });

  it("is hidden with DAPPMANAGER 10.0.49, without the installed list, and for other apps", () => {
    const { unmount } = render(<PackageControls {...baseProps} packages={[teku, dm("10.0.49")]} dnp={teku} isCore={false} />);
    expect(screen.queryByRole("button", { name: "Free up space" })).not.toBeInTheDocument();
    unmount();
    const r2 = render(<PackageControls {...baseProps} dnp={teku} isCore={false} />);
    expect(screen.queryByRole("button", { name: "Free up space" })).not.toBeInTheDocument();
    r2.unmount();
    const geth = { name: "ethchain-geth.public.dappnode.eth", state: "running", manifest: { title: "Geth" } };
    render(<PackageControls {...baseProps} packages={[geth, dm("10.0.50")]} dnp={geth} isCore={false} />);
    expect(screen.queryByRole("button", { name: "Free up space" })).not.toBeInTheDocument();
  });
});
