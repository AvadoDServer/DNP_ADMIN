import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import StakingSetup from "../StakingSetup";

let mockPackages = [];
vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: () => mockPackages }));

const p = name => ({ name, state: "running" });

const renderAt = () =>
  render(
    <Provider store={createStore(() => ({}))}>
      <MemoryRouter>
        <StakingSetup />
      </MemoryRouter>
    </Provider>
  );

beforeEach(() => {
  localStorage.clear();
  mockPackages = [];
});

describe("StakingSetup", () => {
  it("tells the user to install a consensus client first for manual steps when none is installed", () => {
    renderAt();
    expect(screen.getAllByText("Install a consensus client first")).toHaveLength(2); // keys + feeRecipient
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("persists a manual checkbox tick to localStorage under avado.stakingSetup.<consensus package name>", () => {
    mockPackages = [p("nimbus.avado.dnp.dappnode.eth")];
    renderAt();
    const [keysCheckbox] = screen.getAllByRole("checkbox", { name: "I've done this" });
    fireEvent.click(keysCheckbox);
    const stored = JSON.parse(localStorage.getItem("avado.stakingSetup.nimbus.avado.dnp.dappnode.eth"));
    expect(stored).toMatchObject({ keys: true });
  });

  it("shows how many of the 4 required steps are done", () => {
    mockPackages = ["ethchain-geth.public.dappnode.eth", "nimbus.avado.dnp.dappnode.eth"].map(p);
    renderAt();
    expect(screen.getByText("2 of 4 required steps done")).toBeInTheDocument();
  });

  it("shows a network note only when clients for more than one network are installed", () => {
    mockPackages = ["nimbus.avado.dnp.dappnode.eth", "nimbus-holesky.avado.dnp.dappnode.eth"].map(p);
    renderAt();
    expect(screen.getByText(/You also have Holesky testnet clients installed/)).toBeInTheDocument();
  });

  it("shows no network note when only mainnet clients are installed", () => {
    mockPackages = ["nimbus.avado.dnp.dappnode.eth"].map(p);
    renderAt();
    expect(screen.queryByText(/You also have/)).not.toBeInTheDocument();
  });
});
