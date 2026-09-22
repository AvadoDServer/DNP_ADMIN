import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import ManifestStore from "../ManifestStore";

const LONG_TITLE =
  "Nimbus Beacon Chain and Validator Client for Ethereum Mainnet Staking Operations";

/** Renders the current router location so navigation can be asserted on. */
function LocationDisplay() {
  return (
    <Route
      path="*"
      render={({ location }) => (
        <div data-testid="location">{location.pathname}</div>
      )}
    />
  );
}

function renderStore(directory, openDnp = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/installer"]}>
      <ManifestStore directory={directory} openDnp={openDnp} />
      <LocationDisplay />
    </MemoryRouter>
  );
  return openDnp;
}

const notInstalled = {
  manifest: { name: "geth.dnp.dappnode.eth", title: "Geth", version: "1.0.0" },
  manifesthash: "/ipfs/QmInstall",
};

const installedWithUpdate = {
  manifest: { name: "geth.dnp.dappnode.eth", title: "Geth", version: "1.2.0" },
  manifesthash: "/ipfs/QmUpdate",
  installed: true,
  installedVersion: "1.0.0",
};

const installedUpToDate = {
  manifest: { name: "geth.dnp.dappnode.eth", title: "Geth", version: "1.0.0" },
  manifesthash: "/ipfs/QmUpToDate",
  installed: true,
  installedVersion: "1.0.0",
};

describe("ManifestStore", () => {
  it("shows Install for a not-installed entry", () => {
    renderStore([notInstalled]);
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("shows Update to v<version> for an installed entry with a newer store version", () => {
    renderStore([installedWithUpdate]);
    expect(
      screen.getByRole("button", { name: "Update to v1.2.0" })
    ).toBeInTheDocument();
  });

  it("shows Installed as a link to /packages/<name> for an up-to-date entry", () => {
    renderStore([installedUpToDate]);
    const link = screen.getByRole("link", { name: "Installed" });
    expect(link).toHaveAttribute("href", "/packages/geth.dnp.dappnode.eth");
  });

  it("renders a long title in full, with break-words and no truncate", () => {
    renderStore([
      {
        manifest: {
          name: "nimbus.avado.dnp.dappnode.eth",
          title: LONG_TITLE,
          version: "1.0.0",
        },
        manifesthash: "/ipfs/QmLong",
      },
    ]);
    const heading = screen.getByRole("heading", { name: LONG_TITLE });
    expect(heading).toHaveClass("break-words");
    expect(heading).not.toHaveClass("truncate");
    expect(heading.textContent).toBe(LONG_TITLE);
  });

  it("clicking the card body opens the store detail page for an installable/updatable entry", () => {
    const openDnp = renderStore([notInstalled]);
    fireEvent.click(
      screen.getByRole("heading", { name: "Geth" }).closest('[role="button"]')
    );
    expect(openDnp).toHaveBeenCalledWith("/ipfs/QmInstall");
  });

  it("clicking the card body of an installed, up-to-date entry navigates straight to /packages/<name>, same as its button", () => {
    const openDnp = renderStore([installedUpToDate]);
    fireEvent.click(
      screen.getByRole("heading", { name: "Geth" }).closest('[role="button"]')
    );
    expect(openDnp).not.toHaveBeenCalled();
    expect(screen.getByTestId("location").textContent).toBe(
      "/packages/geth.dnp.dappnode.eth"
    );
  });
});
