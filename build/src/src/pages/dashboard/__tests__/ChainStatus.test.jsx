import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ChainStatus from "pages/dashboard/components/ChainStatus";
import { NETWORKS } from "health/clients";

const { useHealthMock, useModeMock } = vi.hoisted(() => ({
  useHealthMock: vi.fn(),
  useModeMock: vi.fn(),
}));
vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));
vi.mock("settings/ModeProvider", () => ({ useMode: useModeMock }));

const nimbus = { name: "nimbus.avado.dnp.dappnode.eth" };

// wallSlot 100 in epoch 3, slot 4 of the epoch (mainnet: genesis + 100*12s).
const now = (NETWORKS.mainnet.genesis + 100 * 12) * 1000;
const checkedAt = new Date(now);

const health = (overrides = {}) => ({
  packages: [nimbus],
  chainData: [],
  metrics: null,
  checkedAt,
  ...overrides,
});

beforeEach(() => {
  useModeMock.mockReturnValue({ isAdvanced: false });
});

describe("ChainStatus — hidden when no consensus client", () => {
  it("renders nothing when no consensus client is installed", () => {
    useHealthMock.mockReturnValue(health({ packages: [] }));
    const { container } = render(<ChainStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a box with only non-consensus packages", () => {
    useHealthMock.mockReturnValue(health({ packages: [{ name: "grafana.avado.dappnode.eth" }] }));
    const { container } = render(<ChainStatus />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ChainStatus — simple line sentence (chainData + epochProgress)", () => {
  it("shows a waiting sentence when chainData hasn't reported this client yet", () => {
    useHealthMock.mockReturnValue(health({ chainData: [] }));
    render(<ChainStatus />);
    expect(screen.getByText("Waiting for chain data.")).toBeInTheDocument();
  });

  it("shows syncing when chainData reports it", () => {
    useHealthMock.mockReturnValue(health({ chainData: [{ name: "Nimbus", syncing: true }] }));
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is syncing with the network.")).toBeInTheDocument();
  });

  it("shows synced (no metrics) when chainData says not syncing and there is no Prometheus data", () => {
    useHealthMock.mockReturnValue(health({ chainData: [{ name: "Nimbus", syncing: false }] }));
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is synced.")).toBeInTheDocument();
  });

  it("shows in step with the network when metrics confirm it (behind <= 2)", () => {
    useHealthMock.mockReturnValue(
      health({
        chainData: [{ name: "Nimbus", syncing: false }],
        metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 99 }], peers: [] },
      })
    );
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is in step with the network.")).toBeInTheDocument();
  });

  it("shows N slots behind when chainData says synced but metrics show it has drifted (> 2 behind)", () => {
    useHealthMock.mockReturnValue(
      health({
        chainData: [{ name: "Nimbus", syncing: false }],
        metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 90 }], peers: [] },
      })
    );
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is 10 slots behind.")).toBeInTheDocument();
  });

  it("has a status light matching the state (success dot when synced)", () => {
    useHealthMock.mockReturnValue(health({ chainData: [{ name: "Nimbus", syncing: false }] }));
    const { container } = render(<ChainStatus />);
    expect(container.querySelector('[data-tone="success"]')).toBeInTheDocument();
  });
});

describe("ChainStatus — Show details (component state, not global mode)", () => {
  it("starts collapsed in Simple mode, with a Show details link", () => {
    useHealthMock.mockReturnValue(health({ chainData: [{ name: "Nimbus", syncing: false }] }));
    render(<ChainStatus />);
    expect(screen.getByRole("button", { name: "Show details" })).toBeInTheDocument();
  });

  it("expands the strip inline when Show details is clicked, without touching global mode", () => {
    const setModeSpy = vi.fn();
    useModeMock.mockReturnValue({ isAdvanced: false, setMode: setModeSpy, toggleMode: setModeSpy });
    useHealthMock.mockReturnValue(
      health({
        chainData: [{ name: "Nimbus", syncing: false }],
        metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 100 }], peers: [{ client: "nimbus", network: "mainnet", value: 16 }] },
      })
    );
    render(<ChainStatus />);
    expect(screen.queryByText(/Epoch/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByText("Epoch 3")).toBeInTheDocument();
    expect(screen.getByText("In step with the network")).toBeInTheDocument();
    expect(screen.getByText("16 peers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide details" })).toBeInTheDocument();
    expect(setModeSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText(/Epoch/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details" })).toBeInTheDocument();
  });
});

describe("ChainStatus — Advanced (global) mode", () => {
  it("always shows the strip, with no Show/Hide details toggle", () => {
    useModeMock.mockReturnValue({ isAdvanced: true });
    useHealthMock.mockReturnValue(
      health({
        chainData: [{ name: "Nimbus", syncing: false }],
        metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 90 }], peers: [{ client: "nimbus", network: "mainnet", value: 1 }] },
      })
    );
    render(<ChainStatus />);
    expect(screen.getByText("Epoch 3")).toBeInTheDocument();
    expect(screen.getByText("10 slots behind")).toBeInTheDocument();
    expect(screen.getByText("1 peer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide details" })).not.toBeInTheDocument();
  });

  it("shows the simple line plus an install-monitoring note when metrics are unavailable", () => {
    useModeMock.mockReturnValue({ isAdvanced: true });
    useHealthMock.mockReturnValue(health({ chainData: [{ name: "Nimbus", syncing: false }], metrics: null }));
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is synced.")).toBeInTheDocument();
    expect(screen.getByText("Install monitoring to see the chain strip.")).toBeInTheDocument();
    expect(screen.queryByText(/Epoch/)).not.toBeInTheDocument();
  });

  it("falls back to the simple line when metrics exist but have no sample for this client/network yet", () => {
    useModeMock.mockReturnValue({ isAdvanced: true });
    useHealthMock.mockReturnValue(
      health({ chainData: [{ name: "Nimbus", syncing: false }], metrics: { headSlot: [], peers: [] } })
    );
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is synced.")).toBeInTheDocument();
    expect(screen.queryByText("Install monitoring to see the chain strip.")).not.toBeInTheDocument();
  });
});

describe("ChainStatus — behind/ahead copy rule", () => {
  const withHeadSlot = value =>
    health({
      chainData: [{ name: "Nimbus", syncing: false }],
      metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value }], peers: [] },
    });

  beforeEach(() => {
    useModeMock.mockReturnValue({ isAdvanced: true });
  });

  it("0 behind reads as in step", () => {
    useHealthMock.mockReturnValue(withHeadSlot(100));
    render(<ChainStatus />);
    expect(screen.getByText("In step with the network")).toBeInTheDocument();
  });

  it("2 behind still reads as in step", () => {
    useHealthMock.mockReturnValue(withHeadSlot(98));
    render(<ChainStatus />);
    expect(screen.getByText("In step with the network")).toBeInTheDocument();
  });

  it("3 behind shows the slot count", () => {
    useHealthMock.mockReturnValue(withHeadSlot(97));
    render(<ChainStatus />);
    expect(screen.getByText("3 slots behind")).toBeInTheDocument();
  });

  it("ahead of wall-clock never shows a negative number — reads as in step", () => {
    useHealthMock.mockReturnValue(withHeadSlot(105));
    render(<ChainStatus />);
    expect(screen.getByText("In step with the network")).toBeInTheDocument();
    expect(screen.queryByText(/-\d+ slots/)).not.toBeInTheDocument();
  });
});

describe("ChainStatus — wall clock is taken from when the metrics sample was fetched", () => {
  const synced = {
    chainData: [{ name: "Nimbus", syncing: false }],
    // Head = wall slot at the fetch time `now`: a perfectly synced client.
    metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 100 }], peers: [] },
    metricsFetchedAt: new Date(now),
    // The 5 s stats poll re-ran the health memo 50 s after the fetch.
    checkedAt: new Date(now + 50 * 1000),
  };

  it("a synced client stays in step when rendered 50 s after the sample was fetched (Simple)", () => {
    useHealthMock.mockReturnValue(health(synced));
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is in step with the network.")).toBeInTheDocument();
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
  });

  it("a synced client stays in step when rendered 50 s after the sample was fetched (Advanced)", () => {
    useModeMock.mockReturnValue({ isAdvanced: true });
    useHealthMock.mockReturnValue(health(synced));
    render(<ChainStatus />);
    expect(screen.getByText("In step with the network")).toBeInTheDocument();
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
  });

  it("still reports a real gap measured at fetch time", () => {
    useHealthMock.mockReturnValue(
      health({ ...synced, metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 90 }], peers: [] } })
    );
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus is 10 slots behind.")).toBeInTheDocument();
  });
});

describe("ChainStatus — chain client reports an error", () => {
  const errored = {
    chainData: [{ name: "Nimbus", error: true, message: "Could not connect to RPC" }],
  };

  it("never shows synced or a green light; says the client can't be reached (Simple)", () => {
    useHealthMock.mockReturnValue(health(errored));
    const { container } = render(<ChainStatus />);
    expect(screen.getByText("Nimbus can't be reached.")).toBeInTheDocument();
    expect(screen.queryByText(/synced|in step/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-tone="success"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-tone="danger"], [data-tone="warning"]')).toBeInTheDocument();
  });

  it("shows the client's message in Advanced, even when metrics are present", () => {
    useModeMock.mockReturnValue({ isAdvanced: true });
    useHealthMock.mockReturnValue(
      health({ ...errored, metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 100 }], peers: [] } })
    );
    render(<ChainStatus />);
    expect(screen.getByText("Nimbus can't be reached.")).toBeInTheDocument();
    expect(screen.getByText("Could not connect to RPC")).toBeInTheDocument();
    expect(screen.queryByText(/In step/)).not.toBeInTheDocument();
  });
});
