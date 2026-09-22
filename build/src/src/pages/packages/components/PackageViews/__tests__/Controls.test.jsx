import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PackageControls } from "pages/packages/components/PackageViews/Controls";

const mockConfirmStop = vi.fn();
vi.mock("pages/packages/components/confirmStopPackage", () => ({
  default: (...args) => mockConfirmStop(...args),
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
