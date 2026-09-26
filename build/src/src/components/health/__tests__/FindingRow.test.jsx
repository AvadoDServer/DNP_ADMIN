import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import FindingRow from "components/health/FindingRow";
import { appRestarting } from "health/rules/apps";
import { chainError, headBehind, lowPeers, missedAttestations } from "health/rules/chain";
import { updateBlocked, UPDATE_BLOCKED_AFTER_MS } from "health/rules/updates";
import { careFindingsFromStatus } from "health/careFindings";
import { diskHigh, diskFillingUp } from "health/rules/storage";
import { appStopped } from "health/rules/apps";
import { pkg, snapshot } from "health/__tests__/fixtures";

const { dismissSpy, modeState, healthState } = vi.hoisted(() => ({
  dismissSpy: vi.fn(),
  modeState: { isAdvanced: false },
  // Installed packages, for the "See the chart" link (Grafana must be installed);
  // machine stats and the disk forecast, for "Get more space".
  healthState: { packages: [], stats: undefined, diskForecast: undefined },
}));
vi.mock("health/HealthProvider", () => ({
  useHealth: () => ({ dismiss: dismissSpy, packages: healthState.packages, stats: healthState.stats, diskForecast: healthState.diskForecast }),
}));
// The "action" fix kind dispatches a real redux-thunk action (see health/fixActions);
// the test store below has no thunk middleware, so stub it out for these tests —
// dispatch behaviour itself is covered by health/__tests__/fixActions.test.js.
vi.mock("health/fixActions", () => ({ runFixAction: vi.fn() }));
// `finding.detail` only renders in Advanced (see settings/visibility.js /
// settings/__tests__/ModeProvider.test.jsx for the mode system itself) —
// stubbed here so each test controls it directly via `modeState`.
vi.mock("settings/ModeProvider", () => ({ useMode: () => modeState }));

beforeEach(() => {
  dismissSpy.mockClear();
  modeState.isAdvanced = false;
  healthState.packages = [];
  healthState.stats = undefined;
  healthState.diskForecast = undefined;
});

const renderRow = (finding, props = {}) =>
  render(
    <Provider store={createStore(() => ({}))}>
      <MemoryRouter>
        <ul>
          <FindingRow finding={finding} {...props} />
        </ul>
      </MemoryRouter>
    </Provider>
  );

const WHY_TEXT = "Without them your validator cannot be reached from outside.";
const STEP_1 = "Open your router's admin page.";

const stepsAndWhyFinding = (overrides = {}) => ({
  id: "ports-closed",
  severity: "warning",
  topic: "access",
  title: "Some ports are closed",
  why: WHY_TEXT,
  fix: { kind: "steps", label: "See how to fix it" },
  steps: [STEP_1, "Forward port 30303 to this device.", "Save and restart your router."],
  ...overrides,
});

describe("FindingRow", () => {
  it("toggling 'Why this matters' shows why without revealing the steps list", () => {
    renderRow(stepsAndWhyFinding());
    fireEvent.click(screen.getByText("Why this matters"));
    expect(screen.getByText(WHY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(STEP_1)).not.toBeInTheDocument();
  });

  it("clicking the steps fix button shows the steps without opening why", () => {
    renderRow(stepsAndWhyFinding());
    fireEvent.click(screen.getByText("See how to fix it"));
    expect(screen.getByText(STEP_1)).toBeInTheDocument();
    // why toggle is still collapsed (shows its closed-state label, not the why text)
    expect(screen.getByText("Why this matters")).toBeInTheDocument();
    expect(screen.queryByText(WHY_TEXT)).not.toBeInTheDocument();
  });

  it("shows Hide for a dismissable finding where hiding is offered (Home) and calls dismiss(id) when clicked", () => {
    renderRow(
      stepsAndWhyFinding({
        id: "remote-access-missing",
        dismissable: true,
        fix: null,
        steps: undefined,
        why: undefined,
      }),
      { canHide: true }
    );
    fireEvent.click(screen.getByText("Hide"));
    expect(dismissSpy).toHaveBeenCalledWith("remote-access-missing");
  });

  it("no Hide outside Home: Help and the app pages list hidden findings anyway", () => {
    renderRow(stepsAndWhyFinding({ id: "remote-access-missing", dismissable: true, fix: null, steps: undefined, why: undefined }));
    expect(screen.queryByText("Hide")).not.toBeInTheDocument();
  });

  it("renders a link to fix.to for a link fix", () => {
    renderRow(
      stepsAndWhyFinding({
        id: "app-stopped:nimbus.avado.dnp.dappnode.eth",
        why: undefined,
        steps: undefined,
        fix: { kind: "link", to: "/packages/nimbus.avado.dnp.dappnode.eth?tab=logs", label: "See why in the logs" },
      })
    );
    const link = screen.getByRole("link", { name: "See why in the logs" });
    expect(link).toHaveAttribute("href", "/packages/nimbus.avado.dnp.dappnode.eth?tab=logs");
  });

  it("disables an action fix button after the first click and shows 'Starting…'", () => {
    vi.useFakeTimers();
    try {
      renderRow(
        stepsAndWhyFinding({
          id: "app-stopped:nimbus.avado.dnp.dappnode.eth",
          why: undefined,
          steps: undefined,
          fix: { kind: "action", action: "restartPackage", label: "Start it" },
        })
      );
      const button = screen.getByRole("button", { name: "Start it" });
      fireEvent.click(button);

      const startingButton = screen.getByRole("button", { name: "Starting…" });
      expect(startingButton).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Start it" })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows finding.detail in Advanced but not in Simple", () => {
    const finding = stepsAndWhyFinding({ detail: "Head slot 15 273 229, wall-clock slot 15 273 294 (65 behind)" });

    const { unmount } = renderRow(finding);
    expect(screen.queryByText(finding.detail)).not.toBeInTheDocument();
    unmount();

    modeState.isAdvanced = true;
    renderRow(finding);
    expect(screen.getByText(finding.detail)).toBeInTheDocument();
  });

  it("shows finding.detail in Simple too when the rule sets detailInSimple", () => {
    const finding = stepsAndWhyFinding({ detail: "Installed 0.0.47, available 0.0.48", detailInSimple: true });
    renderRow(finding);
    expect(screen.getByText(finding.detail)).toBeInTheDocument();
  });

  it("does not render a detail line when the finding has none, even in Advanced", () => {
    modeState.isAdvanced = true;
    renderRow(stepsAndWhyFinding({ detail: undefined }));
    expect(screen.queryByText(/peers|slot/)).not.toBeInTheDocument();
  });

  it("re-enables the action fix button after 15s", () => {
    vi.useFakeTimers();
    try {
      renderRow(
        stepsAndWhyFinding({
          id: "app-stopped:nimbus.avado.dnp.dappnode.eth",
          why: undefined,
          steps: undefined,
          fix: { kind: "action", action: "restartPackage", label: "Start it" },
        })
      );
      fireEvent.click(screen.getByRole("button", { name: "Start it" }));
      expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      const button = screen.getByRole("button", { name: "Start it" });
      expect(button).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("FindingRow written steps behind a link or action fix", () => {
  const RESTART_STEP = "Open the logs and look at the last error before the restart.";
  const restartingFinding = (overrides = {}) => ({
    id: "app-restarting:nimbus.avado.dnp.dappnode.eth",
    severity: "critical",
    topic: "sync",
    title: "Nimbus keeps restarting",
    fix: { kind: "link", to: "/packages/nimbus.avado.dnp.dappnode.eth?tab=logs", label: "Open the logs" },
    steps: [RESTART_STEP, "If it says the disk is full, free space in System → Storage."],
    ...overrides,
  });

  it("adds a 'How to fix it' toggle next to the link that shows and hides the steps", () => {
    renderRow(restartingFinding());
    expect(screen.getByRole("link", { name: "Open the logs" })).toBeInTheDocument();
    expect(screen.queryByText(RESTART_STEP)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "How to fix it" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText(RESTART_STEP)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(screen.queryByText(RESTART_STEP)).not.toBeInTheDocument();
  });

  it("adds the toggle next to an action fix too", () => {
    renderRow(restartingFinding({ fix: { kind: "action", action: "restartPackage", label: "Start it" } }));
    expect(screen.getByRole("button", { name: "Start it" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "How to fix it" }));
    expect(screen.getByText(RESTART_STEP)).toBeInTheDocument();
  });

  it("never adds a second toggle to a 'steps' fix, whatever its label", () => {
    renderRow(stepsAndWhyFinding());
    expect(screen.getByRole("button", { name: "See how to fix it" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How to fix it" })).not.toBeInTheDocument();
  });

  it("keeps a single 'How to fix it' button for a 'steps' fix with that same label (diagnose findings)", () => {
    renderRow(stepsAndWhyFinding({ id: "diagnose:docker", fix: { kind: "steps", label: "How to fix it" } }));
    expect(screen.getAllByRole("button", { name: "How to fix it" })).toHaveLength(1);
  });

  it("gives the real rules' written steps a toggle: restarting, can't be reached, can't update, and Care's fee recipient", () => {
    const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
    const now = 1790103551 * 1000;
    const findings = [
      ...appRestarting(snapshot({ packages: [pkg(NIMBUS, { state: "restarting" })] })),
      ...chainError(snapshot({ packages: [pkg(NIMBUS)], chainData: [{ name: "Nimbus", error: true }] })),
      ...updateBlocked(snapshot({ packages: [pkg(NIMBUS)], updates: { [NIMBUS]: { from: "1.0.0", to: "1.0.1" } }, updateAges: { [NIMBUS]: now - UPDATE_BLOCKED_AFTER_MS }, now })),
      ...careFindingsFromStatus({ findings: [{ id: `fee-recipient-missing:${NIMBUS}`, severity: "critical", topic: "setup", title: "Validators in Nimbus have no fee recipient" }] }),
    ];
    expect(findings).toHaveLength(4);
    for (const finding of findings) {
      const { unmount } = renderRow(finding);
      fireEvent.click(screen.getByRole("button", { name: "How to fix it" }));
      expect(screen.getByText(finding.steps[0])).toBeInTheDocument();
      unmount();
    }
  });

  it("leaves head-behind (already a 'steps' fix) with its own single button", () => {
    const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
    const now = 1790103551 * 1000;
    const [finding] = headBehind(snapshot({ packages: [pkg(NIMBUS)], metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 1 }] }, now }));
    renderRow(finding);
    expect(screen.getByRole("button", { name: "What to check" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How to fix it" })).not.toBeInTheDocument();
  });

  it("shows no toggle without steps (none, or an empty list)", () => {
    const { unmount } = renderRow(restartingFinding({ steps: undefined }));
    expect(screen.queryByRole("button", { name: "How to fix it" })).not.toBeInTheDocument();
    unmount();
    renderRow(restartingFinding({ steps: [] }));
    expect(screen.queryByRole("button", { name: "How to fix it" })).not.toBeInTheDocument();
  });
});

describe("FindingRow learnMore", () => {
  const DOCS = "https://docs.ava.do/staking-ethereum/setting-up-the-eth-clients";
  const noExecution = (overrides = {}) => ({
    id: "consensus-without-execution:mainnet",
    severity: "critical",
    topic: "setup",
    title: "Nimbus has no execution client",
    why: "A consensus client needs an execution client to follow the chain.",
    fix: { kind: "link", to: "/installer?category=ethstaking", label: "Install an execution client" },
    learnMore: DOCS,
    ...overrides,
  });

  it("renders 'Read more' as an external link with the why text under a headline", () => {
    renderRow(noExecution(), { hideTitle: true, showWhy: true });
    const link = screen.getByRole("link", { name: "Read more" });
    expect(link).toHaveAttribute("href", DOCS);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows 'Read more' in a list row once 'Why this matters' is opened", () => {
    renderRow(noExecution());
    expect(screen.queryByRole("link", { name: "Read more" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Why this matters"));
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", DOCS);
  });

  it("renders nothing without learnMore, or for a link that isn't https", () => {
    const { unmount } = renderRow(noExecution({ learnMore: undefined }), { showWhy: true });
    expect(screen.queryByRole("link", { name: "Read more" })).not.toBeInTheDocument();
    unmount();
    renderRow(noExecution({ learnMore: "javascript:alert(1)" }), { showWhy: true });
    expect(screen.queryByRole("link", { name: "Read more" })).not.toBeInTheDocument();
  });
});

describe("FindingRow 'See the chart'", () => {
  const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
  const NIMBUS_CHART = "http://grafana.my.ava.do:3000/d/avado-nimbus?var-instance=nimbus.my.ava.do:8008";
  const now = 1790103551 * 1000;
  const monitoring = (grafanaVersion = "0.0.5") => [
    pkg("grafana.avado.dappnode.eth", { version: grafanaVersion }),
    pkg("prometheus.avado.dappnode.eth", { version: "0.0.2" }),
  ];
  const packages = [pkg(NIMBUS)];
  const [behind] = headBehind(snapshot({ packages, metrics: { headSlot: [{ client: "nimbus", network: "mainnet", value: 1 }] }, now }));
  const [fewPeers] = lowPeers(snapshot({ packages, metrics: { peers: [{ client: "nimbus", network: "mainnet", value: 3 }] } }));
  const [missed] = missedAttestations(
    snapshot({ packages, metrics: { attesterMiss: [{ client: "nimbus", network: "mainnet", value: 4 }], attesterHit: [] } })
  );

  it("opens the app's Grafana dashboard in a new tab on the real falling-behind, few-peers and missed-attestations findings", () => {
    healthState.packages = [...monitoring(), ...packages];
    for (const finding of [behind, fewPeers, missed]) {
      const { unmount } = renderRow(finding);
      const link = screen.getByRole("link", { name: "See the chart" });
      expect(link).toHaveAttribute("href", NIMBUS_CHART);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      unmount();
    }
  });

  it("sits after the why text under a headline, not among the fix buttons", () => {
    healthState.packages = [...monitoring(), ...packages];
    renderRow(fewPeers, { hideTitle: true, showWhy: true });
    const link = screen.getByRole("link", { name: "See the chart" });
    expect(link.closest("p")).toHaveTextContent(`${fewPeers.why} See the chart`);
    expect(screen.getByRole("link", { name: "Improve connectivity" }).parentElement).not.toContainElement(link);
  });

  it("shows next to 'Why this matters' in a list row, and after the why text (with 'Read more') once opened", () => {
    healthState.packages = [...monitoring(), ...packages];
    renderRow({ ...behind, learnMore: "https://docs.ava.do/" });
    expect(screen.getByRole("link", { name: "See the chart" }).parentElement).toHaveTextContent("· See the chart");
    expect(screen.getByRole("button", { name: "What to check" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Why this matters"));
    expect(screen.getByText(behind.why)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the chart" }).closest("p")).toHaveTextContent("Read more · See the chart");
  });

  it("is hidden until Grafana 0.0.3 or newer and Prometheus run", () => {
    const cases = [
      packages,
      [...monitoring("0.0.2"), ...packages],
      [pkg("grafana.avado.dappnode.eth", { version: "0.0.5", running: false, state: "exited" }), pkg("prometheus.avado.dappnode.eth"), ...packages],
      [pkg("grafana.avado.dappnode.eth", { version: "0.0.5" }), pkg("prometheus.avado.dappnode.eth", { running: false, state: "exited" }), ...packages],
    ];
    for (const installed of cases) {
      healthState.packages = installed;
      const { unmount } = renderRow(fewPeers);
      expect(screen.queryByRole("link", { name: "See the chart" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("is not added to other findings, to Lighthouse (no dashboard), or to compact rows", () => {
    healthState.packages = [...monitoring(), ...packages, pkg("lighthouse.avado.dnp.dappnode.eth")];
    const { unmount } = renderRow(chainError(snapshot({ packages, chainData: [{ name: "Nimbus", error: true }] }))[0]);
    expect(screen.queryByRole("link", { name: "See the chart" })).not.toBeInTheDocument();
    unmount();
    const [lighthouse] = lowPeers(
      snapshot({ packages: [pkg("lighthouse.avado.dnp.dappnode.eth")], metrics: { peers: [{ client: "lighthouse", network: "mainnet", value: 3 }] } })
    );
    const second = renderRow(lighthouse);
    expect(screen.queryByRole("link", { name: "See the chart" })).not.toBeInTheDocument();
    second.unmount();
    renderRow(fewPeers, { compact: true });
    expect(screen.queryByRole("link", { name: "See the chart" })).not.toBeInTheDocument();
  });
});

describe("FindingRow 'Get more space' (4 TB kit)", () => {
  const I7 = "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz";
  const DAY = 86400;
  const trend = { free: 300e9, slope7d: -15e9 / DAY, slope2d: -14e9 / DAY, slopeHourly: -16e9 / DAY, hoursOfData: 168 };
  const forecast = { state: "filling", days: 19.7, free: 300e9 };
  const diskFull = () => diskHigh(snapshot({ stats: { disk: "85%" } }));

  it("a disk finding on an i7 with the 2 TB disk links to the kit card on System > Storage", () => {
    healthState.stats = { cpuName: I7, diskTotal: "1.82 TB", disk: "85%" };
    renderRow(diskFull(), { hideTitle: true, showWhy: true });
    const link = screen.getByRole("link", { name: "Get more space" });
    expect(link).toHaveAttribute("href", "/system/storage?kit=1");
    expect(link).not.toHaveAttribute("target");
    // The fix stays "Free up space".
    expect(screen.getByRole("link", { name: "Free up space" })).toHaveAttribute("href", "/system/storage");
  });

  it("also on the forecast's own finding", () => {
    healthState.stats = { cpuName: I7, diskTotal: "1.82 TB", disk: "60%" };
    healthState.diskForecast = forecast;
    renderRow(diskFillingUp(snapshot({ stats: { disk: "60%" }, diskTrend: trend })));
    expect(screen.getByRole("link", { name: "Get more space" })).toHaveAttribute("href", "/system/storage?kit=1");
  });

  it("not on other boxes, without the core's stats, on other findings, or in compact rows", () => {
    const cases = [
      { cpuName: I7, diskTotal: "3.64 TB", disk: "85%" },
      { cpuName: "Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz", diskTotal: "0.91 TB", disk: "85%" },
      { disk: "85%" },
      undefined,
    ];
    for (const stats of cases) {
      healthState.stats = stats;
      const { unmount } = renderRow(diskFull());
      expect(screen.queryByRole("link", { name: "Get more space" })).not.toBeInTheDocument();
      unmount();
    }
    healthState.stats = { cpuName: I7, diskTotal: "1.82 TB", disk: "85%" };
    const [stopped] = appStopped(snapshot({ packages: [pkg("rotki.avado.dnp.dappnode.eth", { state: "exited", running: false })] }));
    const other = renderRow(stopped);
    expect(screen.queryByRole("link", { name: "Get more space" })).not.toBeInTheDocument();
    other.unmount();
    renderRow(diskFull(), { compact: true });
    expect(screen.queryByRole("link", { name: "Get more space" })).not.toBeInTheDocument();
  });
});
