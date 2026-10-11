import { lostData } from "health/rules/lostData";
import { ALL_RULES } from "health/rules";
import { runChecksDetailed } from "health/engine";
import { pkg, snapshot } from "./fixtures";

const RP = "rocketpool.avado.dnp.dappnode.eth";
const WHY =
  "After an update the app started with empty storage while its old storage is still on this AVADO. Recover it to get the app's data back. Nothing is deleted.";

const candidate = (name, extra = {}) => ({
  name,
  anonymous: false,
  createdAt: "2025-03-01T10:00:00Z",
  entries: [".rocketpool", "data"],
  sizeKb: 2048,
  target: "rocketpoolavadodnpdappnodeeth_rocketpool",
  ...extra,
});
const entry = (packageName, candidates, extra = {}) => ({
  package: packageName,
  live: [{ name: "rocketpoolavadodnpdappnodeeth_rocketpool", mountPath: "/rocketpool" }],
  candidates,
  ...extra,
});
const run = (lost, packages = [pkg(RP, { manifest: { name: RP, title: "Rocket Pool" } })]) =>
  lostData(snapshot({ packages, lostData: lost }));

describe("lostData rule", () => {
  it("is part of ALL_RULES", () => {
    expect(ALL_RULES).toContain(lostData);
  });

  it("finds nothing when lostData is not there (older DAPPMANAGER) or empty", () => {
    expect(run(undefined)).toEqual([]);
    expect(run(null)).toEqual([]);
    expect(run([])).toEqual([]);
    expect(run([entry(RP, [])])).toEqual([]);
    expect(run("nonsense")).toEqual([]);
  });

  it("makes one finding per candidate, linking to the app page", () => {
    const vol1 = "rocketpool-avado-dnp-dappnode-eth_rocketpool";
    const vol2 = "a".repeat(64);
    expect(run([entry(RP, [candidate(vol1), candidate(vol2, { anonymous: true })])])).toEqual([
      {
        id: `lost-data:${RP}:${vol1}`,
        severity: "warning",
        topic: "setup",
        appId: RP,
        title: "Rocket Pool has data in an unused storage volume",
        why: WHY,
        fix: { kind: "link", to: `/packages/${RP}?tab=overview`, label: "Recover data" },
        dismissable: true,
      },
      {
        id: `lost-data:${RP}:${vol2}`,
        severity: "warning",
        topic: "setup",
        appId: RP,
        title: "Rocket Pool has data in an unused storage volume",
        why: WHY,
        fix: { kind: "link", to: `/packages/${RP}?tab=overview`, label: "Recover data" },
        dismissable: true,
      },
    ]);
  });

  it("covers several packages", () => {
    const TEKU = "teku.avado.dnp.dappnode.eth";
    const found = run(
      [entry(RP, [candidate("v1")]), entry(TEKU, [candidate("v2")])],
      [pkg(RP, { manifest: { title: "Rocket Pool" } }), pkg(TEKU, { manifest: { title: "Teku" } })]
    );
    expect(found.map(f => f.id)).toEqual([`lost-data:${RP}:v1`, `lost-data:${TEKU}:v2`]);
    expect(found.map(f => f.title)).toEqual([
      "Rocket Pool has data in an unused storage volume",
      "Teku has data in an unused storage volume",
    ]);
  });

  it("falls back to the package name before the first dot when there is no manifest title", () => {
    expect(run([entry(RP, [candidate("v1")])], [pkg(RP, { manifest: {} })])[0].title).toBe(
      "rocketpool has data in an unused storage volume"
    );
    // Not in the installed list at all
    expect(run([entry(RP, [candidate("v1")])], [])[0].title).toBe("rocketpool has data in an unused storage volume");
  });

  it("skips malformed entries and candidates", () => {
    expect(run([null, { candidates: [candidate("v1")] }, entry(RP, [null, { sizeKb: 1 }, candidate("ok")])]).map(f => f.id)).toEqual([
      `lost-data:${RP}:ok`,
    ]);
  });

  it("counts as a passed check when there is nothing to recover, and is skipped without the data", () => {
    expect(runChecksDetailed(snapshot({ lostData: [] }), [lostData])).toEqual({ findings: [], passed: 1, total: 1 });
    // An older DAPPMANAGER: the check never ran, so it is not counted as passed
    expect(runChecksDetailed(snapshot(), [lostData])).toEqual({ findings: [], passed: 0, total: 0 });
  });
});
