import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppCard from "components/apps/AppCard";

vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ findings: [], updates: {} }) }));

const LONG_TITLE =
  "Nimbus Beacon Chain and Validator Client for Ethereum Mainnet Staking Operations";

describe("AppCard", () => {
  it("renders the full title, uncut, with break-words instead of truncate", () => {
    const pkg = {
      name: "nimbus.avado.dnp.dappnode.eth",
      state: "running",
      running: true,
      manifest: { title: LONG_TITLE, shortDescription: "Beacon chain and validator" },
    };
    render(
      <MemoryRouter>
        <AppCard pkg={pkg} />
      </MemoryRouter>
    );

    const heading = screen.getByRole("heading", { name: LONG_TITLE });
    expect(heading).toHaveClass("break-words");
    expect(heading).not.toHaveClass("truncate");
    expect(heading.textContent).toBe(LONG_TITLE);
  });
});
