import { mevboostRelays } from "health/rules/mevboost";
import { ALL_RULES } from "health/rules";
import { MEVBOOST_PACKAGE } from "health/clients";
import { BUNDLED } from "pages/packages/apps/mevboost/relayListApi";

const live = BUNDLED.relays.filter(r => r.status === "live");
const retired = BUNDLED.relays.find(r => r.status === "retired");
const CUSTOM = `https://0x${"ab".repeat(48)}@relay.example.org`;

const RETIRED_WHY = "At least one of its relays is no longer running, so it waits on an answer that never comes.";
const ONE_WHY = "It uses only one relay, so it gets few bids for your blocks.";
const NONE_WHY = "None of its relays is on AVADO's list, so AVADO cannot tell whether they work.";

const mev = (relays, extra = {}) => ({
  name: MEVBOOST_PACKAGE,
  state: "running",
  isCore: false,
  manifest: {},
  envs: relays === undefined ? {} : { RELAYS: relays },
  ...extra,
});
const run = (...packages) => mevboostRelays({ packages });

describe("mevboostRelays", () => {
  it("is part of ALL_RULES", () => {
    expect(ALL_RULES).toContain(mevboostRelays);
  });

  it("finds nothing when the relays are live and on AVADO's list", () => {
    expect(run(mev(live.slice(0, 3).map(r => r.url).join(",")))).toEqual([]);
  });

  it("warns when a relay is retired, with a link to the app page", () => {
    expect(run(mev([live[0].url, live[1].url, retired.url].join(",")))).toEqual([
      {
        id: "mevboost-relays",
        severity: "warning",
        topic: "setup",
        appId: MEVBOOST_PACKAGE,
        title: "MEV-Boost relays need a look",
        why: RETIRED_WHY,
        fix: { kind: "link", to: `/packages/${MEVBOOST_PACKAGE}?tab=overview`, label: "Check relays" },
      },
    ]);
  });

  it("says retired before one relay", () => {
    expect(run(mev(retired.url))[0].why).toBe(RETIRED_WHY);
  });

  it("warns when it uses only one relay", () => {
    expect(run(mev(live[0].url))[0].why).toBe(ONE_WHY);
  });

  it("says one relay before none known", () => {
    expect(run(mev(CUSTOM))[0].why).toBe(ONE_WHY);
  });

  it("warns when none of its relays is on the list", () => {
    const other = `https://0x${"cd".repeat(48)}@other.example.org`;
    expect(run(mev(`${CUSTOM},${other}`))[0].why).toBe(NONE_WHY);
  });

  it("counts a list relay with a different key as unknown", () => {
    const wrongKey = live[0].url.replace(/0x[0-9a-f]{96}/i, `0x${"ef".repeat(48)}`);
    const other = live[1].url.replace(/0x[0-9a-f]{96}/i, `0x${"ef".repeat(48)}`);
    expect(run(mev(`${wrongKey},${other}`))[0].why).toBe(NONE_WHY);
  });

  it("warns with the none-known sentence when RELAYS is empty", () => {
    expect(run(mev(""))[0].why).toBe(NONE_WHY);
  });

  it("reads the manifest default when the box has no value", () => {
    const manifest = { image: { environment: [`RELAYS=${live[0].url}`, "EXTRA_OPTS="] } };
    expect(run(mev(undefined, { manifest }))[0].why).toBe(ONE_WHY);
    const fine = { image: { environment: [`RELAYS=${live[0].url},${live[1].url}`] } };
    expect(run(mev(undefined, { manifest: fine, envs: undefined }))).toEqual([]);
  });

  it("stays quiet when it cannot tell (no RELAYS setting at all)", () => {
    expect(run(mev(undefined))).toEqual([]);
    expect(run(mev(undefined, { manifest: null, envs: null }))).toEqual([]);
  });

  it("finds nothing when MEV-Boost is not installed", () => {
    expect(run({ name: "nimbus.avado.dnp.dappnode.eth", state: "running", envs: { RELAYS: "" } })).toEqual([]);
    expect(mevboostRelays({})).toEqual([]);
  });

  it("finds nothing when MEV-Boost is stopped", () => {
    expect(run(mev(retired.url, { state: "exited" }))).toEqual([]);
    expect(run(mev("", { state: "restarting" }))).toEqual([]);
  });
});
