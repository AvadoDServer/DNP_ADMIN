import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModeProvider } from "settings/ModeProvider";
import { storageRows, SystemStorage, MONITORING_INSTALL_PATH } from "pages/system/components/SystemStorage";
import { diskForecast } from "health/rules/storage";
import { KIT_URL } from "health/diskUpgrade";

const { healthState } = vi.hoisted(() => ({ healthState: { diskForecast: { state: "none" }, diskTrendStatus: "not-installed" } }));
vi.mock("health/HealthProvider", () => ({ useHealth: () => healthState }));

const DAY = 86400;
const GB = 1e9;
const I7 = "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz";
const MONITORING = [{ name: "prometheus.avado.dappnode.eth" }, { name: "node-exporter.avado.dappnode.eth" }, { name: "grafana.avado.dappnode.eth" }];
// A steady fill: every measure agrees, a week of data.
const steady = (freeGb, gbPerDay) => ({
  free: freeGb * GB,
  slope7d: -(gbPerDay * GB) / DAY,
  slope2d: -(gbPerDay * 1.1 * GB) / DAY,
  slopeHourly: -(gbPerDay * 0.9 * GB) / DAY,
  hoursOfData: 168,
});

const setForecast = (trend, chainData = [], status = "ok") => {
  healthState.diskForecast = diskForecast(trend, chainData);
  healthState.diskTrendStatus = status;
};

const renderPage = ({ packages = MONITORING, stats = { disk: "50%" }, path = "/system/storage", mode = "simple" } = {}) => {
  localStorage.setItem("avado.mode", mode);
  return render(
    <ModeProvider>
      <MemoryRouter initialEntries={[path]}>
        <SystemStorage dnpInstalled={packages} dappnodeStats={stats} runSignedCmd={() => {}} />
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
    setForecast({ free: 3670755098624, slope7d: -116708.24767425397, slope2d: -27224.815493410486, slopeHourly: -23428.052247141637, hoursOfData: 75 });
    renderPage();
    expect(screen.getByText("At this rate your disk has room for at least 11 months · 3.34 TB free")).toBeInTheDocument();
  });

  it("explains why there is no forecast instead of guessing", () => {
    const cases = [
      [{ ...steady(300, 15), hoursOfData: 20 }, [], "A forecast of when your disk is full shows after 2 days of monitoring."],
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
    expect(screen.getByText("Priority Care members get 10% off and a guided move to the new disk.")).toBeInTheDocument();
    const shop = screen.getByRole("link", { name: "See the 4 TB kit" });
    expect(shop).toHaveAttribute("href", KIT_URL);
    expect(shop).toHaveAttribute("target", "_blank");
    expect(shop.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: "About Priority Care" })).toHaveAttribute("href", "/priority");
  });

  it("shows below 75 % when the forecast says full within 60 days", () => {
    setForecast(steady(500, 10)); // 50 days
    renderPage({ stats: i7("60%") });
    expect(card()).toBeInTheDocument();
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
