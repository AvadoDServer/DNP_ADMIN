import { getClient, canResetBeaconData, CONSENSUS_SIZE_LIMIT, BEACON_RESET_SINCE } from "health/clients";
import { consensusTooBig } from "health/rules/storage";
import { ALL_RULES } from "health/rules";
import { pkg, snapshot } from "./fixtures";

const DM = "dappmanager.dnp.dappnode.eth";
const TEKU = "teku.avado.dnp.dappnode.eth";
const dm = version => pkg(DM, { isCore: true, version });
const big = (name, gb, extra = {}) => pkg(name, { volumes: [{ size: `${gb}GB` }], manifest: { title: name.split(".")[0] === "teku" ? "Teku" : name.split(".")[0] }, ...extra });

describe("canResetBeacon and the DAPPMANAGER gate", () => {
  it("is true for exactly the packages the DAPPMANAGER can reset", () => {
    for (const n of [
      "teku.avado.dnp.dappnode.eth", "teku-gnosis.avado.dnp.dappnode.eth", "teku-holesky.avado.dnp.dappnode.eth", "teku-prater.avado.dnp.dappnode.eth",
      "lighthouse.avado.dnp.dappnode.eth", "lighthouse-gnosis.avado.dnp.dappnode.eth", "lighthouse-holesky.avado.dnp.dappnode.eth",
      "nimbus.avado.dnp.dappnode.eth", "nimbus-holesky.avado.dnp.dappnode.eth", "nimbus-prater.avado.dnp.dappnode.eth",
      "prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth",
    ])
      expect(getClient(n).canResetBeacon, n).toBe(true);
    for (const n of ["eth2validator.avado.dnp.dappnode.eth", "ethchain-geth.public.dappnode.eth", "mevboost.avado.dnp.dappnode.eth", "grafana.avado.dappnode.eth"])
      expect(getClient(n).canResetBeacon, n).toBe(false);
  });

  it("exports the limit and the first DAPPMANAGER version", () => {
    expect(CONSENSUS_SIZE_LIMIT).toBe(200e9);
    expect(BEACON_RESET_SINCE).toBe("10.0.50");
  });

  it("canResetBeaconData needs a DAPPMANAGER of 10.0.50 or newer", () => {
    expect(canResetBeaconData([dm("10.0.50")])).toBe(true);
    expect(canResetBeaconData([dm("10.0.51")])).toBe(true);
    expect(canResetBeaconData([dm("10.1.0")])).toBe(true);
    expect(canResetBeaconData([dm("11.0.0")])).toBe(true);
    expect(canResetBeaconData([dm("10.0.49")])).toBe(false);
    expect(canResetBeaconData([dm("10.0.9")])).toBe(false);
    expect(canResetBeaconData([dm("9.9.99")])).toBe(false);
  });

  it("canResetBeaconData is false when the version is missing or invalid, or the DAPPMANAGER is absent", () => {
    expect(canResetBeaconData([dm(undefined)])).toBe(false);
    expect(canResetBeaconData([dm("")])).toBe(false);
    expect(canResetBeaconData([dm("latest")])).toBe(false);
    expect(canResetBeaconData([dm(10)])).toBe(false);
    expect(canResetBeaconData([pkg("other.dnp.dappnode.eth", { version: "99.0.0" })])).toBe(false);
    expect(canResetBeaconData([])).toBe(false);
    expect(canResetBeaconData(null)).toBe(false);
  });
});

describe("consensusTooBig", () => {
  const run = packages => consensusTooBig(snapshot({ packages }));

  it("is registered in ALL_RULES", () => {
    expect(ALL_RULES).toContain(consensusTooBig);
  });

  it("stays quiet at or under 200 GB", () => {
    expect(run([big(TEKU, 199), dm("10.0.50")])).toEqual([]);
    expect(run([big(TEKU, 200), dm("10.0.50")])).toEqual([]);
  });

  it("883 GB Teku with DAPPMANAGER 10.0.50: a Free up space action", () => {
    const out = run([big(TEKU, 883, { envs: { EXTRA_OPTS: "--data-storage-mode=archive" } }), dm("10.0.50")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: `consensus-too-big:${TEKU}`,
      severity: "warning",
      topic: "storage",
      appId: TEKU,
      title: "Teku is using 883.0 GB",
      why: "Normal is under 200 GB. Free up space deletes only its chain data and downloads a recent checkpoint instead. Your validator keys, slashing protection and settings stay. Your validators are offline for about 15 to 30 minutes while it syncs again.",
      detail: "Storage mode: Full history (archive)",
      fix: { kind: "action", action: "resetBeaconData", label: "Free up space" },
    });
  });

  it("with DAPPMANAGER 10.0.49, a link to System > Storage instead", () => {
    const [f] = run([big(TEKU, 883), dm("10.0.49")]);
    expect(f.fix).toEqual({ kind: "link", to: "/system/storage", label: "See storage" });
    expect(f.appId).toBe(TEKU);
  });

  it("without a DAPPMANAGER in the list, a link", () => {
    expect(run([big(TEKU, 883)])[0].fix.kind).toBe("link");
  });

  it("eth2validator never gets the action", () => {
    const [f] = run([big("eth2validator.avado.dnp.dappnode.eth", 250), dm("10.0.50")]);
    expect(f.fix).toEqual({ kind: "link", to: "/system/storage", label: "See storage" });
  });

  it("execution clients never match", () => {
    expect(run([big("ethchain-geth.public.dappnode.eth", 900), big("avado-dnp-nethermind.public.dappnode.eth", 900), dm("10.0.50")])).toEqual([]);
  });

  it("one finding per oversized consensus client", () => {
    const out = run([big(TEKU, 300), big("nimbus.avado.dnp.dappnode.eth", 250), big("lighthouse.avado.dnp.dappnode.eth", 100), dm("10.0.50")]);
    expect(out.map(f => f.id).sort()).toEqual(["consensus-too-big:nimbus.avado.dnp.dappnode.eth", `consensus-too-big:${TEKU}`]);
  });
});
