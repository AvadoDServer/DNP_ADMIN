import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppCard from "components/apps/AppCard";

const { useHealthMock } = vi.hoisted(() => ({ useHealthMock: vi.fn() }));
vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));

const LONG_TITLE =
  "Nimbus Beacon Chain and Validator Client for Ethereum Mainnet Staking Operations";

const nimbus = (overrides = {}) => ({
  name: "nimbus.avado.dnp.dappnode.eth",
  state: "running",
  running: true,
  manifest: { title: LONG_TITLE, shortDescription: "Beacon chain and validator" },
  ...overrides,
});

const renderCard = pkg =>
  render(
    <MemoryRouter>
      <AppCard pkg={pkg} />
    </MemoryRouter>
  );

beforeEach(() => {
  useHealthMock.mockReturnValue({ findings: [], updates: {} });
});

describe("AppCard", () => {
  it("renders the full title, uncut, with break-words instead of truncate", () => {
    renderCard(nimbus());

    const heading = screen.getByRole("heading", { name: LONG_TITLE });
    expect(heading).toHaveClass("break-words");
    expect(heading).not.toHaveClass("truncate");
    expect(heading.textContent).toBe(LONG_TITLE);
  });

  it("is a single link wrapping the whole bay, and carries the focus-ring class", () => {
    renderCard(nimbus());

    const link = screen.getByRole("link", { name: new RegExp(LONG_TITLE) });
    expect(link).toHaveAttribute("href", "/packages/nimbus.avado.dnp.dappnode.eth");
    expect(link).toHaveClass("focus-visible:shadow-focus");
  });

  it("draws a red inset ring when the app has a critical finding", () => {
    const pkg = nimbus();
    useHealthMock.mockReturnValue({
      findings: [{ appId: pkg.name, severity: "critical", id: "x" }],
      updates: {},
    });
    renderCard(pkg);

    const link = screen.getByRole("link", { name: new RegExp(LONG_TITLE) });
    expect(link.className).toMatch(/ring-danger/);
  });

  it("has no critical-finding ring when there is no matching critical finding", () => {
    const pkg = nimbus();
    useHealthMock.mockReturnValue({
      findings: [{ appId: pkg.name, severity: "warning", id: "x" }],
      updates: {},
    });
    renderCard(pkg);

    const link = screen.getByRole("link", { name: new RegExp(LONG_TITLE) });
    expect(link.className).not.toMatch(/ring-danger/);
  });
});
