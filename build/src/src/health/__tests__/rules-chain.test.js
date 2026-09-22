import { chainSyncing, headBehind, lowPeers, missedAttestations } from "health/rules/chain";
import { pkg, snapshot } from "./fixtures";

const NIMBUS = pkg("nimbus.avado.dnp.dappnode.eth", { manifest: { title: "Nimbus Consensus Client" } });
const now = 1790103551 * 1000; // wall-clock mainnet slot 15 273 294

const metrics = (overrides = {}) => ({ headSlot: [], peers: [], attesterMiss: [], attesterHit: [], ...overrides });

describe("chain rules", () => {
  it("reports syncing chains from chainData", () => {
    const f = chainSyncing(snapshot({ chainData: [{ name: "Nimbus", syncing: true, progress: 0.42, message: "Syncing 42%" }] }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ severity: "info", topic: "sync", title: "Nimbus is syncing (42%)" });
  });

  it("flags a head more than two epochs behind the wall clock", () => {
    const behind = snapshot({ now, packages: [NIMBUS], metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273294 - 65 }] }) });
    expect(headBehind(behind)[0]).toMatchObject({ severity: "warning", appId: "nimbus.avado.dnp.dappnode.eth" });
    const fine = snapshot({ now, packages: [NIMBUS], metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273292 }] }) });
    expect(headBehind(fine)).toEqual([]);
    expect(headBehind(snapshot({ packages: [NIMBUS], metrics: null }))).toEqual([]);
  });

  it("flags fewer than 10 peers", () => {
    const s = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 4 }] }) });
    expect(lowPeers(s)[0]).toMatchObject({ severity: "warning", title: "Nimbus Consensus Client has only 4 peers" });
    const ok = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 16 }] }) });
    expect(lowPeers(ok)).toEqual([]);
  });

  it("flags missed attestations, critical above half missed", () => {
    const some = snapshot({ packages: [NIMBUS], metrics: metrics({
      attesterMiss: [{ client: "nimbus", network: "mainnet", value: 2 }],
      attesterHit: [{ client: "nimbus", network: "mainnet", value: 18 }],
    }) });
    expect(missedAttestations(some)[0]).toMatchObject({ severity: "warning", topic: "attestations", title: "2 attestations missed in the last hour" });
    const most = snapshot({ packages: [NIMBUS], metrics: metrics({
      attesterMiss: [{ client: "nimbus", network: "mainnet", value: 12 }],
      attesterHit: [{ client: "nimbus", network: "mainnet", value: 3 }],
    }) });
    expect(missedAttestations(most)[0].severity).toBe("critical");
    const none = snapshot({ packages: [NIMBUS], metrics: metrics({ attesterMiss: [{ client: "nimbus", network: "mainnet", value: 0 }] }) });
    expect(missedAttestations(none)).toEqual([]);
  });
});
