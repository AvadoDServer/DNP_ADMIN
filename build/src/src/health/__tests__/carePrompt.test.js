import {
  CARE_PROMPT_KINDS,
  CARE_PROMPT_HIDE_DAYS,
  isCarePromptFinding,
  showCarePrompt,
  readCarePromptHiddenUntil,
  hideCarePrompt,
} from "health/carePrompt";
import { CARE_PACKAGE } from "health/careFindings";
import { appStopped, appRestarting, coreAppDown } from "health/rules/apps";
import { chainError, chainSyncing } from "health/rules/chain";
import { diskHigh } from "health/rules/storage";
import { updatesAvailable } from "health/rules/updates";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-06T12:00:00Z");
const TEKU = "teku.avado.dnp.dappnode.eth";
const f = (id, severity = "warning") => ({ id, severity, topic: "sync", title: `title ${id}`, why: `why ${id}` });
const packages = [{ name: TEKU, isCore: false, state: "running" }];
const care = { name: CARE_PACKAGE, isCore: false, state: "running" };
const show = (findings, extra = {}) => showCarePrompt({ findings, packages, now: NOW, hiddenUntil: null, ...extra });

beforeEach(() => localStorage.clear());

describe("showCarePrompt: which findings count", () => {
  it.each([
    ["an app is stopped", f(`app-stopped:${TEKU}`, "critical")],
    ["an app that is not a client is stopped", f("app-stopped:ipfs-pinner.avado.dnp.dappnode.eth", "warning")],
    ["an app keeps restarting", f(`app-restarting:${TEKU}`, "critical")],
    ["a core app is down", f("core-app-down:wifi.dnp.dappnode.eth", "critical")],
    ["the disk is nearly full", f("disk-high", "warning")],
    ["the disk is nearly full and it is urgent", f("disk-high", "critical")],
    ["the disk is filling up", f("disk-filling-up", "warning")],
    ["a chain client can't be reached", f("chain-error:Teku", "warning")],
    ["a client is behind the chain", f(`head-behind:${TEKU}`, "warning")],
    ["validators miss attestations", f(`missed-attestations:${TEKU}`, "warning")],
    ["validators miss most attestations", f(`missed-attestations:${TEKU}`, "critical")],
  ])("shows when %s", (_, finding) => {
    expect(isCarePromptFinding(finding)).toBe(true);
    expect(show([finding])).toBe(true);
  });

  it("shows when one real problem sits among informational findings", () => {
    expect(show([f("updates-available"), f("no-upnp", "info"), f("disk-high", "critical")])).toBe(true);
  });

  it.each([
    "updates-available",
    "core-update-available",
    `update-blocked:${TEKU}`,
    `autoupdate-off:${TEKU}`,
    "store-unreachable",
    "chain-syncing:Teku",
    `low-peers:${TEKU}`,
    `consensus-too-big:${TEKU}`,
    "ports-closed",
    "no-upnp",
    "no-nat-loopback",
    "remote-access-missing",
    "monitoring-missing",
    "monitoring-stopped",
    "metrics-unavailable",
    "diagnose:internet",
    `fee-recipient-missing:${TEKU}`,
    "two-validator-clients:mainnet",
    // Only the part before the ":" is the kind.
    "diagnose:disk-high",
    "disk-high-ish",
  ])("does not show for %s", id => {
    expect(show([f(id, "warning")])).toBe(false);
    expect(show([f(id, "critical")])).toBe(false);
  });

  it("does not show for an informational finding, even of a listed kind", () => {
    expect(show([f("disk-high", "info")])).toBe(false);
    expect(show([{ id: "disk-high", title: "no severity" }])).toBe(false);
  });

  it("does not show when there are no findings", () => {
    expect(show([])).toBe(false);
    expect(show(undefined)).toBe(false);
    expect(showCarePrompt()).toBe(false);
    expect(show([null, {}, { id: 5, severity: "critical" }])).toBe(false);
  });

  // The ids above are not made up: these are what the rules really raise.
  it("matches what the health rules raise", () => {
    const stopped = { name: "ipfs-pinner.avado.dnp.dappnode.eth", isCore: false, state: "exited" };
    const restarting = { name: "ipfs-pinner.avado.dnp.dappnode.eth", isCore: false, state: "restarting" };
    const coreDown = { name: "wifi.dnp.dappnode.eth", isCore: true, running: false, state: "exited" };
    const real = [
      ...appStopped({ packages: [stopped] }),
      ...appRestarting({ packages: [restarting] }),
      ...coreAppDown({ packages: [coreDown] }),
      ...chainError({ chainData: [{ name: "Teku", error: true, message: "no answer" }], packages: [] }),
      diskHigh({ stats: { disk: "95%" }, packages: [] }),
    ];
    expect(real.map(r => r.id.split(":")[0])).toEqual(["app-stopped", "app-restarting", "core-app-down", "chain-error", "disk-high"]);
    for (const finding of real) expect(isCarePromptFinding(finding)).toBe(true);

    const calm = [
      ...chainSyncing({ chainData: [{ name: "Teku", syncing: true, progress: 0.5 }] }),
      updatesAvailable({ updates: { [TEKU]: { from: "1", to: "2" } } }),
    ];
    expect(calm).toHaveLength(2);
    for (const finding of calm) expect(isCarePromptFinding(finding)).toBe(false);
  });

  it("lists every kind once", () => {
    expect(new Set(CARE_PROMPT_KINDS).size).toBe(CARE_PROMPT_KINDS.length);
    expect(CARE_PROMPT_KINDS).toHaveLength(8);
  });
});

describe("showCarePrompt: who sees it", () => {
  const problem = [f(`app-stopped:${TEKU}`, "critical")];

  it("does not show when AVADO Care is installed, running or not", () => {
    expect(show(problem, { packages: [...packages, care] })).toBe(false);
    expect(show(problem, { packages: [...packages, { ...care, state: "exited" }] })).toBe(false);
  });

  it("shows when the package list is empty or missing", () => {
    expect(show(problem, { packages: [] })).toBe(true);
    expect(show(problem, { packages: undefined })).toBe(true);
    expect(show(problem, { packages: [null, {}] })).toBe(true);
  });

  it('stays hidden while "Not now" still holds', () => {
    expect(show(problem, { hiddenUntil: NOW + DAY })).toBe(false);
    expect(show(problem, { hiddenUntil: NOW + 30 * DAY })).toBe(false);
  });

  it('shows again once "Not now" has run out', () => {
    expect(show(problem, { hiddenUntil: NOW - 1 })).toBe(true);
    expect(show(problem, { hiddenUntil: NOW })).toBe(true);
    expect(show(problem, { hiddenUntil: null })).toBe(true);
  });

  it("ignores a hidden-until that makes no sense", () => {
    // Further away than "Not now" can ever set it: a clock that was wrong.
    expect(show(problem, { hiddenUntil: NOW + 31 * DAY })).toBe(true);
    expect(show(problem, { hiddenUntil: "tomorrow" })).toBe(true);
    expect(show(problem, { hiddenUntil: NaN })).toBe(true);
  });
});

describe("Not now", () => {
  it("hides the prompt for 30 days and remembers it", () => {
    expect(CARE_PROMPT_HIDE_DAYS).toBe(30);
    expect(readCarePromptHiddenUntil()).toBeNull();
    const until = hideCarePrompt(NOW);
    expect(until).toBe(NOW + 30 * DAY);
    expect(localStorage.getItem("avado.carePromptHiddenUntil")).toBe(String(NOW + 30 * DAY));
    expect(readCarePromptHiddenUntil()).toBe(until);
  });

  it("survives broken or blocked storage", () => {
    localStorage.setItem("avado.carePromptHiddenUntil", "soon");
    expect(readCarePromptHiddenUntil()).toBeNull();
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(readCarePromptHiddenUntil()).toBeNull();
    get.mockRestore();
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(hideCarePrompt(NOW)).toBe(NOW + 30 * DAY);
    set.mockRestore();
  });
});
