import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModeProvider } from "settings/ModeProvider";
import { storageRows, SystemStorage, MONITORING_INSTALL_PATH } from "pages/system/components/SystemStorage";
import { diskForecast } from "health/rules/storage";
import { KIT_URL } from "health/diskUpgrade";
import { PRIORITY_CARE_EMAIL } from "pages/priority/data";

const { healthState } = vi.hoisted(() => ({ healthState: { diskForecast: { state: "none" }, diskTrendStatus: "not-installed" } }));
vi.mock("health/HealthProvider", () => ({ useHealth: () => healthState }));

const DAY = 86400;
const GB = 1e9;
const I7 = "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz";
const MONITORING = [{ name: "prometheus.avado.dappnode.eth" }, { name: "node-exporter.avado.dappnode.eth" }, { name: "grafana.avado.dappnode.eth" }];
// A steady fill: every measure agrees, a week of data.
const steady = (freeGb, gbPerDay, hoursOfData = 168) => ({
  free: freeGb * GB,
  slope7d: -(gbPerDay * GB) / DAY,
  slope2d: -(gbPerDay * 1.1 * GB) / DAY,
  slopeHourly: -(gbPerDay * 0.9 * GB) / DAY,
  slopeRecent: -(gbPerDay * GB) / DAY,
  hoursOfData,
});

const setForecast = (trend, chainData = [], status = "ok") => {
  healthState.diskForecast = diskForecast(trend, chainData);
  healthState.diskTrendStatus = status;
};

const renderPage = ({ packages = MONITORING, stats = { disk: "50%" }, params, path = "/system/storage", mode = "simple" } = {}) => {
  localStorage.setItem("avado.mode", mode);
  return render(
    <ModeProvider>
      <MemoryRouter initialEntries={[path]}>
        <SystemStorage dnpInstalled={packages} dappnodeStats={stats} dappnodeParams={params} runSignedCmd={() => {}} />
      </MemoryRouter>
    </ModeProvider>
  );
};

beforeEach(() => {
  localStorage.clear();
  healthState.diskForecast = { state: "none" };
  healthState.diskTrendStatus = "not-installed";
});

describe("SystemStorage disk meter", () => {
  const renderDisk = disk => renderPage({ packages: [], stats: { disk } });

  it("parses the percentage the same way as Home (parsePercent), tolerating a '%' suffix", () => {
    renderDisk("42.4%");
    expect(screen.getByText("42% used")).toBeInTheDocument();
  });

  it("is at the accent/warning threshold right at 80%, not just above it", () => {
    const { container } = renderDisk("80%");
    expect(container.querySelector(".bg-warning")).toBeInTheDocument();
    expect(container.querySelector(".bg-danger")).not.toBeInTheDocument();
  });

  it("is at the warning/danger threshold right at 90%, not just above it", () => {
    const { container } = renderDisk("90%");
    expect(container.querySelector(".bg-danger")).toBeInTheDocument();
  });

  it("is accent (not warning) below 80%", () => {
    const { container } = renderDisk("79%");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
    expect(container.querySelector(".bg-warning")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-danger")).not.toBeInTheDocument();
  });
});

describe("SystemStorage disk forecast", () => {
  it("without monitoring: one line linking to install it", () => {
    renderPage({ packages: [] });
    expect(screen.getByRole("link", { name: "Install monitoring to see a forecast" })).toHaveAttribute("href", MONITORING_INSTALL_PATH);
    // Prometheus alone is not enough: the disk figures come from node-exporter.
    const { unmount } = renderPage({ packages: [{ name: "prometheus.avado.dappnode.eth" }] });
    expect(screen.getAllByRole("link", { name: "Install monitoring to see a forecast" })).toHaveLength(2);
    unmount();
  });

  it("says when the disk is full at this rate, with the free space", () => {
    setForecast(steady(300, 15));
    renderPage();
    expect(screen.getByText("At this rate your disk is full in about 3 weeks · 279 GB free")).toBeInTheDocument();
    expect(screen.queryByText(/Install monitoring/)).not.toBeInTheDocument();
  });

  it("Advanced mode adds how much fills up a day", () => {
    setForecast(steady(300, 15));
    renderPage({ mode: "advanced" });
    expect(screen.getByText("At this rate your disk is full in about 3 weeks · 279 GB free · about 14 GB a day")).toBeInTheDocument();
  });

  it("more than a year when the disk is stable or slow to fill", () => {
    setForecast(steady(3000, 0));
    renderPage();
    expect(screen.getByText("At this rate your disk has room for more than a year · 2.73 TB free")).toBeInTheDocument();
    setForecast(steady(3000, 5)); // 599 days at the 7-day pace
    renderPage();
    expect(screen.getAllByText(/has room for more than a year/)).toHaveLength(2);
  });

  it("paces that disagree but all leave months: only the lower bound (the test box, 2026-09-26)", () => {
    setForecast({
      free: 3670755098624,
      slope7d: -116708.24767425397,
      slope2d: -27224.815493410486,
      slopeHourly: -23428.052247141637,
      slopeRecent: -55.868391116237945,
      hoursOfData: 75,
    });
    renderPage();
    expect(screen.getByText("At this rate your disk has room for at least 11 months · 3.34 TB free")).toBeInTheDocument();
  });

  it("explains why there is no forecast instead of guessing", () => {
    const cases = [
      [{ ...steady(300, 15), hoursOfData: 20 }, [], "A forecast of when your disk is full shows after 2 days of monitoring."],
      // 4 days of data agreeing on 3 weeks: a date that close waits for a week.
      [steady(300, 15, 100), [], "A forecast of when your disk is full shows after a week of monitoring."],
      // The fill stopped in the last hours (a sync that just ended).
      [{ ...steady(300, 15), slopeRecent: -(2 * GB) / DAY }, [], "Your disk use changed a lot recently, so there is no forecast until it settles."],
      [steady(300, 15), [{ name: "Geth", syncing: true }], "No forecast while a client is syncing: syncing fills the disk much faster than usual."],
      [{ ...steady(300, 15), slope7d: -(70 * GB) / DAY }, [], "Your disk use changed a lot recently, so there is no forecast until it settles."],
      [null, [], "No forecast right now: your monitoring isn't answering."],
    ];
    for (const [trend, chainData, text] of cases) {
      setForecast(trend, chainData, trend ? "ok" : "failed");
      const { unmount } = renderPage();
      expect(screen.getByText(text)).toBeInTheDocument();
      expect(screen.queryByText(/At this rate/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows nothing while the first answer is on its way", () => {
    healthState.diskTrendStatus = "loading";
    renderPage();
    expect(screen.queryByText(/forecast/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/At this rate/)).not.toBeInTheDocument();
  });
});

describe("SystemStorage 4 TB upgrade kit", () => {
  const i7 = (disk, diskTotal = "1.82 TB") => ({ cpuName: I7, diskTotal, disk, diskUsed: "1.40 TB" });
  const card = () => screen.queryByRole("heading", { name: "Need more space? Upgrade to 4 TB" });

  it("shows on an i7 with the 2 TB disk at 75 % full, and says plainly what the move involves", () => {
    renderPage({ stats: i7("75%") });
    expect(card()).toBeInTheDocument();
    expect(screen.getByText(/It costs €700/)).toBeInTheDocument();
    expect(screen.getByText(/Back up your validator keys first/)).toBeInTheDocument();
    expect(screen.getByText(/download the chain again/)).toBeInTheDocument();
    const shop = screen.getByRole("link", { name: "See the 4 TB kit" });
    expect(shop).toHaveAttribute("href", KIT_URL);
    expect(shop).toHaveAttribute("target", "_blank");
    expect(shop.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: "About Priority Care" })).toHaveAttribute("href", "/priority");
  });

  it("tells Priority Care members how to claim the discount and the guided move (the shop sells at full price)", () => {
    renderPage({ stats: i7("75%"), params: { nodeid: "0x2c7536e3605d9c16a7a3d7b1898e529396a65c23" } });
    expect(screen.getByText(/Priority Care member\?/).textContent).toBe(
      "Priority Care member? Email us before you order. You get 10% off, and we guide you through the move."
    );
    const mail = screen.getByRole("link", { name: "Email us" });
    const href = mail.getAttribute("href");
    expect(href.startsWith(`mailto:${PRIORITY_CARE_EMAIL}?subject=`)).toBe(true);
    const url = new URL(href);
    expect(url.searchParams.get("subject")).toBe("4 TB upgrade kit (Priority Care)");
    expect(url.searchParams.get("body")).toContain("Node ID: 0x2c7536e3605d9c16a7a3d7b1898e529396a65c23");
    expect(url.searchParams.get("body")).toContain("member discount and a guided move");
  });

  it("the member email works without a node id", () => {
    renderPage({ stats: i7("75%") });
    const body = new URL(screen.getByRole("link", { name: "Email us" }).getAttribute("href")).searchParams.get("body");
    expect(body).not.toContain("Node ID");
  });

  it("Rocket Pool owners are sent to support first: their wallet has to move too", () => {
    const text = /If you run Rocket Pool, contact AVADO support before you start/;
    renderPage({ stats: i7("80%"), packages: [...MONITORING, { name: "rocketpool.avado.dnp.dappnode.eth" }] });
    expect(screen.getByText(text).textContent).toBe(
      "If you run Rocket Pool, contact AVADO support before you start: your Rocket Pool wallet has to move to the new disk too."
    );
    // Everyone still backs up their validator keys.
    expect(screen.getByText(/Back up your validator keys first/)).toBeInTheDocument();
  });

  it("no Rocket Pool sentence without Rocket Pool", () => {
    renderPage({ stats: i7("80%") });
    expect(card()).toBeInTheDocument();
    expect(screen.queryByText(/Rocket Pool/)).not.toBeInTheDocument();
  });

  it("names the free space to win back first: test-network apps, above the price", () => {
    const packages = [
      ...MONITORING,
      { name: "avado-dnp-nethermind.public.dappnode.eth", manifest: { title: "Nethermind" }, volumes: [{ size: "1.2TB" }] },
      { name: "nimbus-prater.avado.dnp.dappnode.eth", manifest: { title: "Nimbus Prater" }, volumes: [{ size: "250GB" }] },
    ];
    renderPage({ stats: i7("76%"), packages });
    const hint = screen.getByText(/Before you buy, free what you can\./);
    expect(hint.textContent).toBe(
      "Before you buy, free what you can. Nimbus Prater is for a test network that has shut down: removing it frees 250.0 GB."
    );
    const price = screen.getByText(/It costs €700/);
    expect(hint.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no 'Before you buy' line without test-network apps", () => {
    renderPage({
      stats: i7("76%"),
      packages: [...MONITORING, { name: "avado-dnp-nethermind.public.dappnode.eth", manifest: { title: "Nethermind" }, volumes: [{ size: "1.2TB" }] }],
    });
    expect(card()).toBeInTheDocument();
    expect(screen.queryByText(/Before you buy/)).not.toBeInTheDocument();
  });

  it("shows below 75 % when the forecast says full within 60 days", () => {
    setForecast(steady(500, 10)); // 50 days
    renderPage({ stats: i7("60%") });
    expect(card()).toBeInTheDocument();
  });

  it("not on a forecast with under a week of data (a sync in the first days)", () => {
    setForecast(steady(500, 10, 100)); // would be 50 days, 4 days of data
    renderPage({ stats: i7("60%") });
    expect(card()).not.toBeInTheDocument();
  });

  it("is hidden while there is room: under 75 % and no forecast under 60 days", () => {
    setForecast(steady(700, 10)); // 70 days
    renderPage({ stats: i7("60%") });
    expect(card()).not.toBeInTheDocument();
  });

  it("is hidden where the kit doesn't fit: other CPUs, a 4 TB disk, or a core without these stats", () => {
    const cases = [
      { cpuName: "Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz", diskTotal: "0.91 TB", disk: "95%" },
      i7("95%", "3.64 TB"),
      { diskTotal: "1.82 TB", disk: "95%" },
      { cpuName: I7, disk: "95%" },
    ];
    for (const stats of cases) {
      const { unmount } = renderPage({ stats });
      expect(card()).not.toBeInTheDocument();
      unmount();
    }
  });

  it("'Get more space' (?kit=1) brings the card into view", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderPage({ stats: i7("85%"), path: "/system/storage?kit=1" });
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      scrollIntoView.mockClear();
      renderPage({ stats: i7("85%") });
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });
});

describe("storageRows", () => {
  it("sorts apps by disk use and computes shares", () => {
    const rows = storageRows([
      { name: "a", volumes: [{ size: 100 }] },
      { name: "b", volumes: [{ size: 300 }, { size: 100 }] },
      { name: "c", volumes: [] },
    ]);
    expect(rows.map(r => r.pkg.name)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ size: 400, share: 0.8 });
  });

  it("leaves out apps using no disk space and returns [] when there are none", () => {
    expect(storageRows([{ name: "empty", volumes: [] }])).toEqual([]);
    expect(storageRows([])).toEqual([]);
    expect(storageRows()).toEqual([]);
  });
});
