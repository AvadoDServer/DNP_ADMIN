import { storageMode } from "health/storageMode";
import { pkg } from "./fixtures";

const TEKU = "teku.avado.dnp.dappnode.eth";
const LH = "lighthouse.avado.dnp.dappnode.eth";
const NIM = "nimbus.avado.dnp.dappnode.eth";
const PRYSM = "prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth";

const L = { minimal: "Recent data only (minimal)", pruned: "All blocks (pruned)", archive: "Full history (archive)" };

describe("storageMode", () => {
  const cases = [
    // Teku: EXTRA_OPTS wins, else the package version decides
    [TEKU, "0.0.75", {}, "pruned"],
    [TEKU, "0.0.76", {}, "minimal"],
    [TEKU, "0.0.80", {}, "minimal"],
    [TEKU, "0.1.0", {}, "minimal"],
    [TEKU, "0.0.9", {}, "pruned"],
    [TEKU, "0.0.76", { EXTRA_OPTS: "--data-storage-mode=archive" }, "archive"],
    [TEKU, "0.0.76", { EXTRA_OPTS: "--foo --data-storage-mode archive" }, "archive"],
    [TEKU, "0.0.76", { EXTRA_OPTS: "--data-storage-mode=ARCHIVE" }, "archive"],
    [TEKU, "0.0.76", { EXTRA_OPTS: "--data-storage-mode=prune" }, "pruned"],
    [TEKU, "0.0.75", { EXTRA_OPTS: "--data-storage-mode=minimal" }, "minimal"],
    [TEKU, "0.0.75", { EXTRA_OPTS: "" }, "pruned"],
    [TEKU, undefined, {}, "pruned"],
    ["teku-gnosis.avado.dnp.dappnode.eth", "0.0.76", {}, "minimal"],
    // Lighthouse
    [LH, "0.0.50", {}, "pruned"],
    [LH, "0.0.50", { EXTRA_OPTS_BEACON_NODE: "--reconstruct-historic-states" }, "archive"],
    [LH, "0.0.50", { EXTRA_OPTS_BEACON_NODE: "--foo --reconstruct-historic-states --bar" }, "archive"],
    [LH, "0.0.50", { EXTRA_OPTS: "--reconstruct-historic-states" }, "pruned"],
    // Nimbus
    [NIM, "0.0.50", {}, "pruned"],
    [NIM, "0.0.50", { EXTRA_OPTS: "--history=archive" }, "archive"],
    [NIM, "0.0.50", { EXTRA_OPTS: "--history=prune" }, "pruned"],
    // Prysm beacon chain and its validator app
    [PRYSM, "0.0.50", {}, "pruned"],
    [PRYSM, "0.0.50", { EXTRA_OPTS: "--slots-per-archive-point=32" }, "archive"],
    ["eth2validator.avado.dnp.dappnode.eth", "0.0.50", {}, "pruned"],
  ];
  it.each(cases)("%s %s %j -> %s", (name, version, envs, key) => {
    const m = storageMode(pkg(name, { version, envs }));
    expect(m.key).toBe(key);
    expect(m.label).toBe(L[key]);
    expect(typeof m.detail).toBe("string");
    expect(m.detail.length).toBeGreaterThan(0);
  });

  it("names the deciding setting in detail", () => {
    expect(storageMode(pkg(TEKU, { version: "0.0.76" })).detail).toBe("Teku default for package 0.0.76 and newer");
    expect(storageMode(pkg(TEKU, { version: "0.0.76", envs: { EXTRA_OPTS: "--data-storage-mode=archive" } })).detail).toBe("Set by EXTRA_OPTS");
    expect(storageMode(pkg(LH, { envs: { EXTRA_OPTS_BEACON_NODE: "--reconstruct-historic-states" } })).detail).toContain("--reconstruct-historic-states");
  });

  it("is null for execution clients, tools, unknown and missing packages", () => {
    expect(storageMode(pkg("ethchain-geth.public.dappnode.eth"))).toBeNull();
    expect(storageMode(pkg("grafana.avado.dappnode.eth"))).toBeNull();
    expect(storageMode(pkg("rotki.avado.dnp.dappnode.eth"))).toBeNull();
    expect(storageMode(null)).toBeNull();
    expect(storageMode(undefined)).toBeNull();
  });
});
