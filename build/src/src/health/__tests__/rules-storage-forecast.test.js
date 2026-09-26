import {
  diskForecast,
  diskFillingUp,
  diskHigh,
  atLeast,
  inAbout,
  formatDiskSize,
  DISK_STOP_BYTES,
} from "health/rules/storage";
import { ALL_RULES } from "health/rules";
import { runChecksDetailed } from "health/engine";
import { pkg, snapshot } from "./fixtures";

const DAY = 86400;
const GB = 1e9;
const perDay = gb => -(gb * GB) / DAY; // a slope in bytes per second, filling `gb` a day

// A steady fill: every measure agrees.
const steady = (freeGb, gbPerDay, overrides = {}) => ({
  free: freeGb * GB,
  slope7d: perDay(gbPerDay),
  slope2d: perDay(gbPerDay * 1.1),
  slopeHourly: perDay(gbPerDay * 0.9),
  hoursOfData: 168,
  ...overrides,
});

// Test box, 2026-09-26 (real answers to DISK_QUERIES): 3.67 TB free, 3 days
// of data. On the first day 85 GB were freed and filled again within 6 hours
// (a client syncing again), since then about 2 GB a day: the 7-day trend
// (10 GB a day, 363 days) is 4-5x the 2-day and hourly ones.
const TEST_BOX = { free: 3670755098624, slope7d: -116708.24767425397, slope2d: -27224.815493410486, slopeHourly: -23428.052247141637, hoursOfData: 75 };

describe("diskForecast", () => {
  it("needs the disk trend: none without monitoring data", () => {
    expect(diskForecast(null, [])).toEqual({ state: "none" });
    expect(diskForecast(undefined)).toEqual({ state: "none" });
    expect(diskForecast({ free: null, slope7d: -1 }, [])).toEqual({ state: "none" });
  });

  it("gives no number with under 2 days of data", () => {
    expect(diskForecast(steady(300, 15, { hoursOfData: 47 }), [])).toMatchObject({ state: "collecting", free: 300 * GB, hours: 47 });
    expect(diskForecast(steady(300, 15, { hoursOfData: null }), [])).toMatchObject({ state: "collecting" });
    expect(diskForecast(steady(300, 15, { hoursOfData: 48 }), []).state).toBe("filling");
  });

  it("gives no number while any client syncs (a sync fills hundreds of GB)", () => {
    const chainData = [{ name: "Nethermind", syncing: true, progress: 0.4 }];
    expect(diskForecast(steady(300, 150), chainData).state).toBe("syncing");
    // An unreachable client or a synced one doesn't count.
    expect(diskForecast(steady(300, 15), [{ name: "Geth", error: true }, { name: "Nimbus", syncing: false }]).state).toBe("filling");
  });

  it("a client that synced again (a burst in the 7-day trend) is unsettled, not a forecast", () => {
    // 400 GB free on a 2 TB disk; a resync took 500 GB three days ago and the
    // disk has grown 3 GB a day since: the 7-day trend alone says 6 days.
    const trend = { free: 400 * GB, slope7d: perDay(70), slope2d: perDay(3), slopeHourly: perDay(3), hoursOfData: 168 };
    expect(diskForecast(trend, [])).toMatchObject({ state: "unsettled", free: 400 * GB });
    expect(diskFillingUp(snapshot({ diskTrend: trend }))).toBeNull();
  });

  it("a burst with only 3 days of data (the 2-day and 7-day trends both include it) is unsettled by the hourly median", () => {
    const trend = { free: 400 * GB, slope7d: perDay(34), slope2d: perDay(40), slopeHourly: perDay(2), hoursOfData: 75 };
    expect(diskForecast(trend, []).state).toBe("unsettled");
  });

  it("pruning's sawtooth (slow fill, sudden drop) is unsettled", () => {
    // Nethermind fills 4 GB a day between prunes and each prune gives it back.
    const trend = { free: 100 * GB, slope7d: perDay(0.5), slope2d: -perDay(2), slopeHourly: perDay(4), hoursOfData: 168 };
    expect(diskForecast(trend, []).state).toBe("unsettled");
  });

  it("a new pace (the last 2 days much faster) is unsettled until the week agrees", () => {
    const trend = { free: 400 * GB, slope7d: perDay(5), slope2d: perDay(25), slopeHourly: perDay(4), hoursOfData: 168 };
    expect(diskForecast(trend, []).state).toBe("unsettled");
  });

  it("is stable when the disk isn't filling up (slope >= 0)", () => {
    expect(diskForecast(steady(300, 0), []).state).toBe("stable");
    expect(diskForecast({ ...steady(300, 1), slope7d: 1000, slope2d: 0, slopeHourly: 500 }, []).state).toBe("stable");
  });

  it("is stable when every pace gives more than a year, even when they disagree", () => {
    const trend = { free: 3000 * GB, slope7d: perDay(5), slope2d: perDay(0.5), slopeHourly: perDay(1), hoursOfData: 168 };
    expect(diskForecast(trend, [])).toMatchObject({ state: "stable", free: 3000 * GB });
  });

  it("the test box: the paces disagree (the first day's burst), but even the fastest leaves 11 months: roomy", () => {
    const f = diskForecast(TEST_BOX, []);
    expect(f).toMatchObject({ state: "roomy", free: TEST_BOX.free });
    expect(f.days).toBeCloseTo(363.5, 0);
    expect(atLeast(f.days)).toBe("at least 11 months");
    // Once the burst has left the 7-day window, the paces agree on years.
    expect(diskForecast({ ...TEST_BOX, slope7d: TEST_BOX.slope2d, hoursOfData: 168 }, []).state).toBe("stable");
  });

  it("disagreeing paces give only a lower bound, and only when even the fastest leaves 60 days", () => {
    const burst = { free: 1000 * GB, slope7d: perDay(15), slope2d: perDay(2), slopeHourly: perDay(2), hoursOfData: 168 };
    expect(diskForecast(burst, [])).toMatchObject({ state: "roomy" });
    expect(diskForecast(burst, []).days).toBeCloseTo(995 / 15);
    expect(diskForecast({ ...burst, slope7d: perDay(17) }, []).state).toBe("unsettled"); // 58.5 days at the fastest
    expect(atLeast(60)).toBe("at least 2 months");
    expect(atLeast(200)).toBe("at least 6 months");
  });

  it("forecasts the days until 5 GB are left, at the 7-day pace", () => {
    const f = diskForecast(steady(305, 10), []);
    expect(f.state).toBe("filling");
    expect(f.days).toBeCloseTo(30);
    expect(f.bytesPerDay).toBeCloseTo(10 * GB);
    expect(f.hours).toBe(168);
  });

  it("is full at 5 GB left, whatever the trend", () => {
    expect(diskForecast(steady(4, 1), [])).toMatchObject({ state: "full", free: 4 * GB });
    expect(diskForecast({ free: DISK_STOP_BYTES }, [])).toMatchObject({ state: "full" });
  });

  it("needs every slope: a failed slope query gives no forecast", () => {
    expect(diskForecast({ ...steady(300, 10), slopeHourly: null }, [])).toMatchObject({ state: "none", free: 300 * GB });
  });
});

describe("inAbout and formatDiskSize", () => {
  it("says the days in whole steps: days, then weeks, then months", () => {
    expect(inAbout(0.4)).toBe("within a day");
    expect(inAbout(1.2)).toBe("in about 1 day");
    expect(inAbout(5.4)).toBe("in about 5 days");
    expect(inAbout(13.4)).toBe("in about 13 days");
    expect(inAbout(20)).toBe("in about 3 weeks");
    expect(inAbout(59)).toBe("in about 8 weeks");
    expect(inAbout(60)).toBe("in about 2 months");
    expect(inAbout(200)).toBe("in about 7 months");
    expect(inAbout(400)).toBe("in more than a year");
  });

  it("uses the core's own disk units (1024-based, labelled TB/GB)", () => {
    expect(formatDiskSize(2 * 1024 ** 4)).toBe("2.00 TB");
    expect(formatDiskSize(TEST_BOX.free)).toBe("3.34 TB");
    expect(formatDiskSize(412 * 1024 ** 3)).toBe("412 GB");
    expect(formatDiskSize(3.25 * 1024 ** 3)).toBe("3.3 GB");
    expect(formatDiskSize(0)).toBe("0 GB");
    expect(formatDiskSize(undefined)).toBe("0 GB");
  });
});

describe("diskFillingUp", () => {
  const packages = [
    pkg("avado-dnp-nethermind.public.dappnode.eth", { manifest: { title: "Nethermind" }, volumes: [{ name: "data", size: "1.2TB" }] }),
    pkg("nimbus.avado.dnp.dappnode.eth", { manifest: { title: "Nimbus" }, volumes: [{ name: "data", size: "180GB" }] }),
  ];

  it("warns when the disk is full within 30 days", () => {
    const f = diskFillingUp(snapshot({ packages, stats: { disk: "70%" }, diskTrend: steady(300, 15) }));
    expect(f).toMatchObject({
      id: "disk-filling-up",
      severity: "warning",
      topic: "storage",
      title: "Your disk will be full in about 3 weeks",
      fix: { kind: "link", to: "/system/storage", label: "Free up space" },
    });
    expect(f.why).toContain("279 GB is left.");
    expect(f.why).toContain("Most space is used by Nethermind and Nimbus.");
    // The numbers stay in `detail`, which Simple mode doesn't show.
    expect(f.detailInSimple).toBeUndefined();
    expect(f.detail).toBe("279 GB free, filling about 14 GB a day (trend over the last 7 days)");
  });

  it("passes (no finding) at 30 days or more", () => {
    expect(diskFillingUp(snapshot({ diskTrend: steady(310, 10) }))).toBeNull();
    expect(diskFillingUp(snapshot({ diskTrend: steady(1000, 5) }))).toBeNull();
    expect(diskFillingUp(snapshot({ diskTrend: steady(300, 0) }))).toBeNull();
  });

  it("is critical only under 7 days AND under 50 GB free, after a week of data", () => {
    expect(diskFillingUp(snapshot({ diskTrend: steady(40, 8) })).severity).toBe("critical");
    // Under 7 days but 60 GB left: a warning.
    expect(diskFillingUp(snapshot({ diskTrend: steady(60, 12) })).severity).toBe("warning");
    // Under 50 GB but 8 days away: a warning.
    expect(diskFillingUp(snapshot({ diskTrend: steady(45, 5) })).severity).toBe("warning");
    // Close and little left, but only 3 days of data: a warning.
    expect(diskFillingUp(snapshot({ diskTrend: steady(40, 8, { hoursOfData: 72 }) })).severity).toBe("warning");
  });

  it("names the test-network apps as the quickest space to free", () => {
    const withTestnets = [
      ...packages,
      pkg("nimbus-prater.avado.dnp.dappnode.eth", { manifest: { title: "Nimbus Prater" }, volumes: [{ name: "data", size: "120GB" }] }),
      pkg("teku-holesky.avado.dnp.dappnode.eth", { manifest: { title: "Teku Holesky" }, volumes: [{ name: "data", size: "80.1GB" }] }),
      pkg("holesky-geth.avado.dnp.dappnode.eth", { manifest: { title: "Geth Holesky" }, volumes: [] }),
    ];
    const f = diskFillingUp(snapshot({ packages: withTestnets, diskTrend: steady(300, 15) }));
    expect(f.why).toContain("Nimbus Prater is for a test network that has shut down: removing it frees 120.0 GB.");
    expect(f.why).toContain("If you no longer test with Teku Holesky, removing it frees 80.1 GB.");
    // An app using no space isn't worth naming.
    expect(f.why).not.toContain("Geth Holesky");
  });

  it("only runs with a forecast it can trust; stable or filling count as a check", () => {
    const run = s => runChecksDetailed(snapshot(s), [diskFillingUp]);
    const skipped = { findings: [], passed: 0, total: 0 };
    expect(run({ diskTrend: null })).toEqual(skipped);
    expect(run({ diskTrend: steady(300, 15, { hoursOfData: 24 }) })).toEqual(skipped);
    expect(run({ diskTrend: steady(300, 15), chainData: [{ name: "Geth", syncing: true }] })).toEqual(skipped);
    expect(run({ diskTrend: { ...steady(300, 15), slope7d: perDay(70) } })).toEqual(skipped);
    expect(run({ diskTrend: TEST_BOX })).toEqual({ findings: [], passed: 1, total: 1 });
    expect(run({ diskTrend: steady(300, 0) })).toEqual({ findings: [], passed: 1, total: 1 });
    expect(run({ diskTrend: steady(1000, 5) })).toEqual({ findings: [], passed: 1, total: 1 });
    expect(run({ diskTrend: steady(300, 15) }).findings.map(f => f.id)).toEqual(["disk-filling-up"]);
  });

  it("is registered", () => {
    expect(ALL_RULES).toContain(diskFillingUp);
  });
});

describe("disk-high with the forecast folded in", () => {
  const both = s => runChecksDetailed(snapshot(s), [diskHigh, diskFillingUp]);

  it("one finding when both apply: disk-high, with the forecast in its text", () => {
    const { findings, total } = both({ stats: { disk: "85%" }, diskTrend: steady(300, 15) });
    expect(findings.map(f => f.id)).toEqual(["disk-high"]);
    expect(total).toBe(1); // the forecast rule is folded, not counted as passed
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].why).toContain("At this rate it is full in about 3 weeks.");
    expect(findings[0].detail).toContain("filling about 14 GB a day");
  });

  it("a critical forecast makes disk-high critical", () => {
    // A small disk: 85 % full with 40 GB left, full in 5 days.
    const { findings } = both({ stats: { disk: "85%" }, diskTrend: steady(40, 8) });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ id: "disk-high", severity: "critical" });
    expect(findings[0].why).toMatch(/^When the disk is full your clients stop/);
  });

  it("no forecast, or an untrustworthy one, leaves disk-high as it was (AVADO Care has no disk trend)", () => {
    const plain = diskHigh(snapshot({ stats: { disk: "85%" } }));
    expect(plain.why).toBe("Clients keep growing; plan some space now before it becomes urgent. ");
    expect(plain.detail).toBeUndefined();
    const syncing = diskHigh(snapshot({ stats: { disk: "85%" }, diskTrend: steady(300, 15), chainData: [{ syncing: true }] }));
    expect(syncing.why).not.toContain("At this rate");
    const unsettled = diskHigh(snapshot({ stats: { disk: "85%" }, diskTrend: { ...steady(300, 15), slope7d: perDay(70) } }));
    expect(unsettled.why).not.toContain("At this rate");
    const roomy = diskHigh(snapshot({ stats: { disk: "85%" }, diskTrend: TEST_BOX }));
    expect(roomy.why).not.toContain("At this rate");
    const stable = diskHigh(snapshot({ stats: { disk: "85%" }, diskTrend: steady(300, 0) }));
    expect(stable.why).not.toContain("At this rate");
  });

  it("under 80 % the forecast is its own finding", () => {
    const { findings } = both({ stats: { disk: "79%" }, diskTrend: steady(300, 15) });
    expect(findings.map(f => f.id)).toEqual(["disk-filling-up"]);
  });
});
