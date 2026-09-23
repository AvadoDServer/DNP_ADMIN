import React from "react";
import { render, screen } from "@testing-library/react";
import { InstallerByNameView } from "pages/installer/components/InstallerByName";

const store = [{ manifesthash: "/ipfs/QmAdmin", manifest: { name: "admin.dnp.dappnode.eth", version: "10.0.54" } }];
const child = <div>installer page</div>;

describe("InstallerByNameView", () => {
  it("sends a package name to the store's IPFS hash, never asking ENS", () => {
    const history = { replace: vi.fn() };
    render(<InstallerByNameView id="admin.dnp.dappnode.eth" storePackages={store} storeStatus="ok" history={history}>{child}</InstallerByNameView>);
    expect(history.replace).toHaveBeenCalledWith("/installer/%2Fipfs%2FQmAdmin");
    expect(screen.queryByText("installer page")).not.toBeInTheDocument();
  });

  it("waits while the store catalogue is loading", () => {
    const history = { replace: vi.fn() };
    render(<InstallerByNameView id="admin.dnp.dappnode.eth" storePackages={null} storeStatus="loading" history={history}>{child}</InstallerByNameView>);
    expect(screen.getByText("Looking up the package…")).toBeInTheDocument();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it("falls back to the name when the store failed or doesn't list it", () => {
    const history = { replace: vi.fn() };
    const { rerender } = render(<InstallerByNameView id="admin.dnp.dappnode.eth" storePackages={null} storeStatus="failed" history={history}>{child}</InstallerByNameView>);
    expect(screen.getByText("installer page")).toBeInTheDocument();
    rerender(<InstallerByNameView id="rotki.avado.dnp.dappnode.eth" storePackages={store} storeStatus="ok" history={history}>{child}</InstallerByNameView>);
    expect(screen.getByText("installer page")).toBeInTheDocument();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it("opens IPFS hashes directly", () => {
    const history = { replace: vi.fn() };
    render(<InstallerByNameView id="/ipfs/QmAdmin" storePackages={null} storeStatus="loading" history={history}>{child}</InstallerByNameView>);
    expect(screen.getByText("installer page")).toBeInTheDocument();
  });
});
