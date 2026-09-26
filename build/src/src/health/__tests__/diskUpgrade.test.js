import { parseDiskTotalTb, kitFits, showKitOffer, kitFindingLink, KIT_PATH, KIT_URL } from "health/diskUpgrade";

// getStats on core 10.0.47+ (cpuName from os.cpus(), diskTotal from `df /`).
const I7 = "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz";
const i7_2tb = (overrides = {}) => ({ cpuName: I7, diskTotal: "1.82 TB", disk: "50%", ...overrides });
// A forecast with a week of data unless `hours` says otherwise.
const filling = (days, hours = 168) => ({ state: "filling", days, free: 400e9, hours });

describe("parseDiskTotalTb", () => {
  it("reads getStats' TB label", () => {
    expect(parseDiskTotalTb("1.82 TB")).toBe(1.82);
    expect(parseDiskTotalTb("3.64 TB")).toBe(3.64);
    expect(parseDiskTotalTb(" 0.91 tb ")).toBe(0.91);
  });
  it("is null when missing (core before 10.0.47) or unreadable", () => {
    expect(parseDiskTotalTb(undefined)).toBeNull();
    expect(parseDiskTotalTb("")).toBeNull();
    expect(parseDiskTotalTb("NaN TB")).toBeNull();
    expect(parseDiskTotalTb("0.00 TB")).toBeNull();
    expect(parseDiskTotalTb("1863 GB")).toBeNull();
    expect(parseDiskTotalTb(1.82)).toBeNull();
  });
});

describe("kitFits", () => {
  it("fits the i7-10710U with the 2 TB disk", () => {
    expect(kitFits(i7_2tb())).toBe(true);
    expect(kitFits(i7_2tb({ diskTotal: "2.10 TB" }))).toBe(true);
  });
  it("not an i7 that already has 4 TB", () => {
    expect(kitFits(i7_2tb({ diskTotal: "3.64 TB" }))).toBe(false);
  });
  it("not any other AVADO: the kit is incompatible with them", () => {
    expect(kitFits(i7_2tb({ cpuName: "Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz" }))).toBe(false);
    expect(kitFits(i7_2tb({ cpuName: "AMD Ryzen 9 6900HX with Radeon Graphics" }))).toBe(false);
  });
  it("not when cpuName or diskTotal is missing (core before 10.0.47)", () => {
    expect(kitFits(i7_2tb({ cpuName: undefined }))).toBe(false);
    expect(kitFits(i7_2tb({ diskTotal: undefined }))).toBe(false);
    expect(kitFits({})).toBe(false);
    expect(kitFits(undefined)).toBe(false);
  });
});

describe("showKitOffer", () => {
  it("offers the kit at 75 % full", () => {
    expect(showKitOffer(i7_2tb({ disk: "75%" }), { state: "none" })).toBe(true);
    expect(showKitOffer(i7_2tb({ disk: "74%" }), { state: "none" })).toBe(false);
  });
  it("offers the kit when the forecast says full within 60 days", () => {
    expect(showKitOffer(i7_2tb(), filling(45))).toBe(true);
    expect(showKitOffer(i7_2tb(), filling(70))).toBe(false);
    expect(showKitOffer(i7_2tb(), { state: "stable", free: 1e12 })).toBe(false);
    expect(showKitOffer(i7_2tb(), { state: "unsettled", free: 1e11 })).toBe(false);
    expect(showKitOffer(i7_2tb(), undefined)).toBe(false);
  });
  it("the forecast only counts with a week of data behind it (not a burst in the first days)", () => {
    expect(showKitOffer(i7_2tb({ disk: "60%" }), filling(45, 50))).toBe(false);
    expect(showKitOffer(i7_2tb({ disk: "60%" }), filling(45, 155))).toBe(false);
    expect(showKitOffer(i7_2tb({ disk: "60%" }), filling(45, 156))).toBe(true);
    expect(showKitOffer(i7_2tb({ disk: "60%" }), filling(45, 168))).toBe(true);
    expect(showKitOffer(i7_2tb({ disk: "60%" }), { state: "filling", days: 45, free: 400e9 })).toBe(false);
    // The 75 % path doesn't need a forecast.
    expect(showKitOffer(i7_2tb({ disk: "80%" }), filling(45, 50))).toBe(true);
  });
  it("never where the kit doesn't fit, however full", () => {
    expect(showKitOffer(i7_2tb({ diskTotal: "3.64 TB", disk: "95%" }), filling(5))).toBe(false);
    expect(showKitOffer(i7_2tb({ cpuName: undefined, disk: "95%" }), filling(5))).toBe(false);
  });
});

describe("kitFindingLink", () => {
  it("disk findings on a box the kit fits link to the kit card, not straight to the shop", () => {
    const link = kitFindingLink({ id: "disk-high" }, i7_2tb({ disk: "85%" }), { state: "none" });
    expect(link).toEqual({ kind: "link", to: KIT_PATH, label: "Get more space" });
    expect(link.to).not.toContain(KIT_URL);
    expect(kitFindingLink({ id: "disk-filling-up" }, i7_2tb({ disk: "60%" }), filling(20))).toMatchObject({ to: KIT_PATH });
    // Under a week of data: no "Get more space".
    expect(kitFindingLink({ id: "disk-filling-up" }, i7_2tb({ disk: "60%" }), filling(20, 50))).toBeNull();
  });
  it("nothing for other findings or other boxes", () => {
    expect(kitFindingLink({ id: "updates-available" }, i7_2tb({ disk: "85%" }), { state: "none" })).toBeNull();
    expect(kitFindingLink({ id: "disk-high" }, i7_2tb({ disk: "85%", diskTotal: "3.64 TB" }), { state: "none" })).toBeNull();
    expect(kitFindingLink({ id: "disk-high" }, undefined, undefined)).toBeNull();
    expect(kitFindingLink(null, i7_2tb({ disk: "85%" }), undefined)).toBeNull();
  });
});
