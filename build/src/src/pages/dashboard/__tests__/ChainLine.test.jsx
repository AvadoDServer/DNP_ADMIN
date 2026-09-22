import React from "react";
import { render, screen } from "@testing-library/react";
import ChainLine from "pages/dashboard/components/ChainLine";

describe("ChainLine", () => {
  it("shows Syncing and the message while syncing", () => {
    render(<ChainLine chainData={[{ name: "Mainnet", syncing: true, message: "Blocks synced: 543000 / 654000" }]} />);
    expect(screen.getByText("Blocks synced: 543000 / 654000")).toBeInTheDocument();
  });

  it("shows Synced plus the message once synced, when the message doesn't already say so", () => {
    render(<ChainLine chainData={[{ name: "Mainnet", syncing: false, message: "50 peers · head 15273229" }]} />);
    expect(screen.getByText("Synced · 50 peers · head 15273229")).toBeInTheDocument();
  });

  it("doesn't duplicate 'Synced' when the message already says it", () => {
    render(<ChainLine chainData={[{ name: "Mainnet", syncing: false, message: "Synced #0" }]} />);
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.queryByText(/Synced ·/)).not.toBeInTheDocument();
  });

  it("shows plain Synced when there is no message", () => {
    render(<ChainLine chainData={[{ name: "Mainnet", syncing: false }]} />);
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });
});
