import {
  parseRelays,
  serialiseRelays,
  parseExtraOpts,
  serialiseExtraOpts,
  mergeWithList,
  recommendedSelection,
  applyRecommended,
  toEnvs,
  packageEnvs,
  cardRows,
  readMinBid,
  safeAboutUrl,
  listDate,
  sameSettings,
} from "pages/packages/apps/mevboost/relayConfig";

const key = c => "0x" + c.repeat(96);
const url = (c, host) => `https://${key(c)}@${host}`;
const relay = over => ({
  about: "",
  filtering: "none",
  recommended: true,
  status: "live",
  statusSince: "2026-10-11",
  note: "",
  ...over,
});
// Two recommended live relays, one live but not recommended, one retired.
const list = [
  relay({ id: "ultrasound", name: "Ultra Sound", url: url("a", "relay.ultrasound.money"), about: "https://relay.ultrasound.money/" }),
  relay({ id: "agnostic", name: "Agnostic", url: url("b", "agnostic-relay.net") }),
  relay({ id: "titan", name: "Titan", url: url("c", "regional.titanrelay.xyz"), filtering: "sanctions", recommended: false }),
  relay({ id: "bloxroute-ethical", name: "bloXroute Ethical", url: url("d", "bloxroute.ethical.blxrbdn.com"), recommended: false, status: "retired" }),
];

describe("parseRelays", () => {
  it("splits on commas, trims and drops empty entries", () => {
    expect(parseRelays("https://a,https://b").map(r => r.url)).toEqual(["https://a", "https://b"]);
    expect(parseRelays(" https://a , ,https://b ").map(r => r.url)).toEqual(["https://a", "https://b"]);
  });

  it("gives an empty list for an empty or missing value", () => {
    expect(parseRelays("")).toEqual([]);
    expect(parseRelays(undefined)).toEqual([]);
    expect(parseRelays(null)).toEqual([]);
  });

  it("lower-cases the host and pubkey and strips a trailing slash", () => {
    const upper = `https://${key("A")}@Relay.UltraSound.Money/`;
    expect(parseRelays(upper)).toEqual([
      { url: upper, host: "relay.ultrasound.money", pubkey: key("a") },
    ]);
  });

  it("gives a null pubkey when the URL has none", () => {
    expect(parseRelays("https://relay.example.org")).toEqual([
      { url: "https://relay.example.org", host: "relay.example.org", pubkey: null },
    ]);
  });

  it("round-trips a clean value byte for byte", () => {
    const value = [url("a", "relay.ultrasound.money"), url("b", "agnostic-relay.net")].join(",");
    expect(serialiseRelays(parseRelays(value))).toBe(value);
  });
});

describe("parseExtraOpts", () => {
  it("reads -min-bid with nothing else", () => {
    expect(parseExtraOpts("-min-bid 0.05")).toEqual({ minBid: 0.05, rest: "" });
  });

  it("keeps every other option in rest", () => {
    expect(parseExtraOpts("-min-bid 0.05 -request-timeout-getheader 1500")).toEqual({
      minBid: 0.05,
      rest: "-request-timeout-getheader 1500",
    });
    expect(parseExtraOpts("-loglevel debug  -min-bid 0.05   -json")).toEqual({
      minBid: 0.05,
      rest: "-loglevel debug -json",
    });
  });

  it("reads the double-dash and = forms a box's settings can hold", () => {
    expect(parseExtraOpts("--min-bid=0.1")).toEqual({ minBid: 0.1, rest: "" });
    expect(parseExtraOpts("-min-bid=0.1")).toEqual({ minBid: 0.1, rest: "" });
    expect(parseExtraOpts("--min-bid 0.1")).toEqual({ minBid: 0.1, rest: "" });
  });

  it("gives null and leaves the value untouched when the minimum is not a number", () => {
    expect(parseExtraOpts("-min-bid abc")).toEqual({ minBid: null, rest: "-min-bid abc" });
    expect(parseExtraOpts("-json -min-bid")).toEqual({ minBid: null, rest: "-json -min-bid" });
    expect(parseExtraOpts("-min-bid -1")).toEqual({ minBid: null, rest: "-min-bid -1" });
    expect(parseExtraOpts("-min-bid 0.05 -min-bid 0.1")).toEqual({
      minBid: null,
      rest: "-min-bid 0.05 -min-bid 0.1",
    });
  });

  it("gives 0 when there is no minimum", () => {
    expect(parseExtraOpts("")).toEqual({ minBid: 0, rest: "" });
    expect(parseExtraOpts(undefined)).toEqual({ minBid: 0, rest: "" });
    expect(parseExtraOpts("-json")).toEqual({ minBid: 0, rest: "-json" });
    expect(parseExtraOpts("-min-bid 0")).toEqual({ minBid: 0, rest: "" });
  });

  it("keeps the value exactly as it was, only trimmed, when there is no minimum", () => {
    expect(parseExtraOpts("  -loglevel debug   -json ")).toEqual({ minBid: 0, rest: "-loglevel debug   -json" });
    expect(serialiseExtraOpts(parseExtraOpts("-a  'b c'"))).toBe("-a  'b c'");
  });
});

describe("serialiseExtraOpts", () => {
  it("writes no minimum when it is 0 or null", () => {
    expect(serialiseExtraOpts({ minBid: 0, rest: "-x 1" })).toBe("-x 1");
    expect(serialiseExtraOpts({ minBid: 0, rest: "" })).toBe("");
    expect(serialiseExtraOpts({ minBid: null, rest: "-min-bid abc" })).toBe("-min-bid abc");
  });

  it("writes rest first, then the minimum", () => {
    expect(serialiseExtraOpts({ minBid: 0.02, rest: "" })).toBe("-min-bid 0.02");
    expect(serialiseExtraOpts({ minBid: 0.02, rest: "-x 1" })).toBe("-x 1 -min-bid 0.02");
  });

  it("writes at most 4 decimals and never exponent form", () => {
    expect(serialiseExtraOpts({ minBid: 0.0001, rest: "" })).toBe("-min-bid 0.0001");
    expect(serialiseExtraOpts({ minBid: 0.123456, rest: "" })).toBe("-min-bid 0.1235");
    expect(serialiseExtraOpts({ minBid: 0.1 + 0.2, rest: "" })).toBe("-min-bid 0.3");
    expect(serialiseExtraOpts({ minBid: 0.00001, rest: "-x 1" })).toBe("-x 1");
  });

  it("round-trips a value that holds only the minimum", () => {
    expect(serialiseExtraOpts(parseExtraOpts("-min-bid 0.05"))).toBe("-min-bid 0.05");
  });

  it("drops only the minimum when the user takes every bid", () => {
    const { rest } = parseExtraOpts("-min-bid 0.05 -request-timeout-getheader 1500");
    expect(serialiseExtraOpts({ minBid: 0, rest })).toBe("-request-timeout-getheader 1500");
  });
});

describe("mergeWithList", () => {
  it("ticks the list relays the box has, in list order", () => {
    const rows = mergeWithList(parseRelays([url("b", "agnostic-relay.net"), url("a", "relay.ultrasound.money")].join(",")), list);
    expect(rows.map(r => [r.id, r.checked, r.custom])).toEqual([
      ["ultrasound", true, false],
      ["agnostic", true, false],
      ["titan", false, false],
      ["bloxroute-ethical", false, false],
    ]);
    expect(rows[0]).toMatchObject({
      name: "Ultra Sound",
      url: url("a", "relay.ultrasound.money"),
      host: "relay.ultrasound.money",
      about: "https://relay.ultrasound.money/",
      filtering: "none",
      status: "live",
      recommended: true,
      pubkeyMismatch: false,
    });
  });

  it("matches a relay written with upper-case hex and a trailing slash", () => {
    const rows = mergeWithList(parseRelays(`https://${key("A")}@Relay.UltraSound.Money/`), list);
    expect(rows.find(r => r.id === "ultrasound").checked).toBe(true);
    expect(rows.some(r => r.custom)).toBe(false);
  });

  it("adds a ticked custom row for a host the list does not know, after the list", () => {
    const custom = url("e", "my.custom.relay");
    const rows = mergeWithList(parseRelays([custom, url("a", "relay.ultrasound.money")].join(",")), list);
    expect(rows.map(r => r.id)).toEqual(["ultrasound", "agnostic", "titan", "bloxroute-ethical", "custom:my.custom.relay"]);
    expect(rows[4]).toEqual({
      id: "custom:my.custom.relay",
      name: "my.custom.relay",
      url: custom,
      host: "my.custom.relay",
      about: null,
      filtering: null,
      status: null,
      recommended: false,
      checked: true,
      custom: true,
      pubkeyMismatch: false,
    });
  });

  it("shows a known host with another key as a custom row and leaves the list row unticked", () => {
    const other = url("f", "relay.ultrasound.money");
    const rows = mergeWithList(parseRelays(other), list);
    expect(rows.find(r => r.id === "ultrasound").checked).toBe(false);
    expect(rows[rows.length - 1]).toMatchObject({
      id: "custom:relay.ultrasound.money",
      url: other,
      checked: true,
      custom: true,
      pubkeyMismatch: true,
    });
  });

  it("matches a list relay written without https://", () => {
    const bare = `${key("a")}@relay.ultrasound.money`;
    expect(parseRelays(bare)[0].pubkey).toBe(key("a"));
    const rows = mergeWithList(parseRelays(bare), list);
    expect(rows.find(r => r.id === "ultrasound").checked).toBe(true);
    expect(rows.some(r => r.custom)).toBe(false);
    expect(toEnvs(rows, { minBid: 0, rest: "" }, {}).RELAYS).toBe(url("a", "relay.ultrasound.money"));
  });

  it("keeps custom rows in the box's order and shows a repeated entry once", () => {
    const one = url("e", "one.custom.relay");
    const two = url("e", "two.custom.relay");
    const rows = mergeWithList(parseRelays([two, one, two].join(",")), list);
    expect(rows.filter(r => r.custom).map(r => r.url)).toEqual([two, one]);
  });
});

describe("recommendedSelection and applyRecommended", () => {
  it("selects the recommended live relays", () => {
    expect(recommendedSelection(list)).toEqual(new Set(["ultrasound", "agnostic"]));
    // A stray recommended flag on a retired relay is not followed.
    expect(recommendedSelection([relay({ id: "x", url: url("a", "x.org"), status: "retired" })])).toEqual(new Set());
  });

  it("ticks exactly the recommended live relays and keeps custom rows as they are", () => {
    const box = [url("c", "regional.titanrelay.xyz"), url("d", "bloxroute.ethical.blxrbdn.com"), url("e", "my.custom.relay")];
    const rows = applyRecommended(mergeWithList(parseRelays(box.join(",")), list), list);
    expect(rows.map(r => [r.id, r.checked])).toEqual([
      ["ultrasound", true],
      ["agnostic", true],
      ["titan", false],
      ["bloxroute-ethical", false],
      ["custom:my.custom.relay", true],
    ]);
  });

  it("swaps a rotated key on a recommended relay for the list's address", () => {
    const rotated = url("9", "relay.ultrasound.money");
    const custom = url("e", "my.custom.relay");
    const rows = applyRecommended(mergeWithList(parseRelays([rotated, custom].join(",")), list), list);
    expect(toEnvs(rows, { minBid: 0, rest: "" }, {}).RELAYS).toBe(
      [url("a", "relay.ultrasound.money"), url("b", "agnostic-relay.net"), custom].join(",")
    );
  });

  it("keeps a different key on a relay that is not recommended", () => {
    const rotated = url("9", "regional.titanrelay.xyz");
    const rows = applyRecommended(mergeWithList(parseRelays(rotated), list), list);
    expect(rows.find(r => r.url === rotated)).toMatchObject({ custom: true, pubkeyMismatch: true, checked: true });
  });
});

describe("toEnvs", () => {
  it("writes RELAYS from the ticked rows and EXTRA_OPTS, passing other keys through", () => {
    const custom = url("e", "my.custom.relay");
    const rows = applyRecommended(mergeWithList(parseRelays(custom), list), list);
    const envs = toEnvs(rows, { minBid: 0, rest: "-request-timeout-getheader 1500" }, {
      NETWORK: "mainnet",
      RELAYS: "old",
      EXTRA_OPTS: "-min-bid 0.05 -request-timeout-getheader 1500",
    });
    expect(envs).toEqual({
      NETWORK: "mainnet",
      RELAYS: [url("a", "relay.ultrasound.money"), url("b", "agnostic-relay.net"), custom].join(","),
      EXTRA_OPTS: "-request-timeout-getheader 1500",
    });
  });

  it("writes the list's own URL for a relay the box spelled differently", () => {
    const rows = mergeWithList(parseRelays(`https://${key("A")}@Relay.UltraSound.Money/`), list);
    expect(toEnvs(rows, { minBid: 0.05, rest: "" }, {})).toEqual({
      RELAYS: url("a", "relay.ultrasound.money"),
      EXTRA_OPTS: "-min-bid 0.05",
    });
  });
});

describe("packageEnvs", () => {
  it("overlays the box's values on the manifest defaults", () => {
    const dnp = {
      manifest: { image: { environment: ["NETWORK=mainnet", "RELAYS=default", "EXTRA_OPTS="] } },
      envs: { RELAYS: "mine", EXTRA_OPTS: "--min-bid=0.1" },
    };
    expect(packageEnvs(dnp)).toEqual({ NETWORK: "mainnet", RELAYS: "mine", EXTRA_OPTS: "--min-bid=0.1" });
    expect(parseExtraOpts(packageEnvs(dnp).EXTRA_OPTS).minBid).toBe(0.1);
  });

  it("copes with a package that has no manifest or no envs", () => {
    expect(packageEnvs({ envs: { RELAYS: "mine" } })).toEqual({ RELAYS: "mine" });
    expect(packageEnvs({ manifest: { image: { environment: ["NETWORK=mainnet"] } } })).toEqual({ NETWORK: "mainnet" });
  });
});

describe("readMinBid", () => {
  it("reads an amount from 0.001 to 1 ETH, rounded to 4 decimals", () => {
    expect(readMinBid("0.05")).toBe(0.05);
    expect(readMinBid(" 0.001 ")).toBe(0.001);
    expect(readMinBid("1")).toBe(1);
    expect(readMinBid("0.123456")).toBe(0.1235);
    expect(readMinBid(".5")).toBe(0.5);
  });

  it("gives null for anything else", () => {
    for (const bad of ["", " ", "abc", "0", "0.0009", "-0.05", "1.01", "5", "1e-3", "0x1", undefined, null]) {
      expect(readMinBid(bad)).toBeNull();
    }
  });
});

describe("safeAboutUrl", () => {
  it("keeps an https address and drops anything else", () => {
    expect(safeAboutUrl("https://relay.ultrasound.money/")).toBe("https://relay.ultrasound.money/");
    for (const bad of ["", null, undefined, "http://relay.example.org", "javascript:alert(1)", "//x.org", "not a url", 5]) {
      expect(safeAboutUrl(bad)).toBeNull();
    }
  });
});

describe("cardRows", () => {
  it("shows a retired relay only when the box has it", () => {
    const has = cardRows({ RELAYS: url("d", "bloxroute.ethical.blxrbdn.com") }, list);
    expect(has.map(r => [r.id, r.checked])).toEqual([
      ["ultrasound", false],
      ["agnostic", false],
      ["titan", false],
      ["bloxroute-ethical", true],
    ]);
    const hasNot = cardRows({ RELAYS: url("a", "relay.ultrasound.money") }, list);
    expect(hasNot.map(r => r.id)).toEqual(["ultrasound", "agnostic", "titan"]);
  });

  it("adds the box's custom relays after the list", () => {
    const rows = cardRows({ RELAYS: url("e", "my.custom.relay") }, list);
    expect(rows.map(r => r.id)).toEqual(["ultrasound", "agnostic", "titan", "custom:my.custom.relay"]);
  });
});

describe("listDate", () => {
  it("writes the list's date out in words, the same in every time zone", () => {
    expect(listDate("2026-10-11")).toBe("October 11, 2026");
    expect(listDate("2026-01-01T00:30:00Z")).toBe("January 1, 2026");
  });

  it("gives the value as it is when it is not a date", () => {
    expect(listDate("soon")).toBe("soon");
    expect(listDate(undefined)).toBe("");
  });
});

describe("sameSettings", () => {
  it("treats the same relays in another order and the same minimum in another spelling as unchanged", () => {
    const a = url("a", "relay.ultrasound.money");
    const b = url("b", "agnostic-relay.net");
    expect(sameSettings({ RELAYS: `${a},${b}`, EXTRA_OPTS: "-min-bid 0.1" }, { RELAYS: ` ${b} ,${a}`, EXTRA_OPTS: "--min-bid=0.1" })).toBe(true);
    expect(sameSettings({ RELAYS: "", EXTRA_OPTS: "" }, {})).toBe(true);
    expect(sameSettings({ RELAYS: "", EXTRA_OPTS: "-min-bid abc" }, { EXTRA_OPTS: "-min-bid abc" })).toBe(true);
  });

  it("sees a relay or a minimum that changed", () => {
    const a = url("a", "relay.ultrasound.money");
    const b = url("b", "agnostic-relay.net");
    expect(sameSettings({ RELAYS: a, EXTRA_OPTS: "" }, { RELAYS: `${a},${b}`, EXTRA_OPTS: "" })).toBe(false);
    expect(sameSettings({ RELAYS: a, EXTRA_OPTS: "" }, { RELAYS: a, EXTRA_OPTS: "-min-bid 0.05" })).toBe(false);
    expect(sameSettings({ RELAYS: a, EXTRA_OPTS: "-json" }, { RELAYS: a, EXTRA_OPTS: "" })).toBe(false);
  });
});
