import { chainSyncing, chainError, headBehind, lowPeers, missedAttestations } from "health/rules/chain";
import { ALL_RULES } from "health/rules";
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
    expect(headBehind(behind)[0]).toMatchObject({
      severity: "warning",
      appId: "nimbus.avado.dnp.dappnode.eth",
      detail: "Head slot 15 273 229, wall-clock slot 15 273 294 (65 behind)",
    });
    const fine = snapshot({ now, packages: [NIMBUS], metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273292 }] }) });
    expect(headBehind(fine)).toEqual([]);
    expect(headBehind(snapshot({ packages: [NIMBUS], metrics: null }))).toEqual([]);
  });

  it("suppresses head-behind when the matching chain in chainData reports syncing", () => {
    const behind = snapshot({
      now,
      packages: [NIMBUS],
      metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273294 - 65 }] }),
      chainData: [{ name: "Nimbus", syncing: true, message: "Syncing 42%" }],
    });
    expect(headBehind(behind)).toEqual([]);
  });

  it("still flags head-behind when chainData has no matching syncing entry", () => {
    const behind = snapshot({
      now,
      packages: [NIMBUS],
      metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273294 - 65 }] }),
      chainData: [{ name: "Nimbus", syncing: false }, { name: "Geth", syncing: true }],
    });
    expect(headBehind(behind)).toHaveLength(1);
  });

  it("does not suppress mainnet Nimbus head-behind when a different network variant (Nimbus-holesky) is syncing", () => {
    // DAPPMANAGER names chainData entries shortNameCapitalized(dnpName), so
    // "Nimbus-holesky" (from nimbus-holesky.avado.dnp.dappnode.eth) is a
    // different, unrelated package's chain — a *substring* match against
    // "nimbus" would wrongly suppress this finding; an exact match must not.
    const behind = snapshot({
      now,
      packages: [NIMBUS],
      metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273294 - 65 }] }),
      chainData: [{ name: "Nimbus-holesky", syncing: true }],
    });
    expect(headBehind(behind)).toHaveLength(1);
  });

  it("flags fewer than 10 peers", () => {
    const s = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 4 }] }) });
    expect(lowPeers(s)[0]).toMatchObject({
      severity: "warning",
      title: "Nimbus Consensus Client has only 4 peers",
      detail: "4 peers (Prometheus libp2p_peers)",
    });
    const ok = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 16 }] }) });
    expect(lowPeers(ok)).toEqual([]);
  });

  it("uses the singular 'peer' for exactly 1 peer", () => {
    const s = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 1 }] }) });
    expect(lowPeers(s)[0]).toMatchObject({
      title: "Nimbus Consensus Client has only 1 peer",
      detail: "1 peer (Prometheus libp2p_peers)",
    });
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

  it("declares rule.needs = 'metrics' so runChecksDetailed can skip them when metrics is null", () => {
    expect(headBehind.needs).toBe("metrics");
    expect(lowPeers.needs).toBe("metrics");
    expect(missedAttestations.needs).toBe("metrics");
  });
});

describe("chainError rule", () => {
  const GETH = pkg("ethchain-geth.public.dappnode.eth", { manifest: { title: "Geth" } });

  it("turns a chainData error entry into a warning that links to the client's app page", () => {
    const f = chainError(
      snapshot({ packages: [NIMBUS], chainData: [{ name: "Nimbus", error: true, message: "Could not connect to RPC" }] })
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      id: "chain-error:Nimbus",
      severity: "warning",
      topic: "sync",
      appId: "nimbus.avado.dnp.dappnode.eth",
      title: "Nimbus Consensus Client can't be reached",
      detail: "Could not connect to RPC",
      fix: { kind: "link", to: "/packages/nimbus.avado.dnp.dappnode.eth" },
    });
    expect(f[0].steps.length).toBeGreaterThan(0);
  });

  it("covers execution clients too, and entries with no matching package", () => {
    const f = chainError(
      snapshot({
        packages: [GETH],
        chainData: [
          { name: "Ethchain-geth", error: true, message: "Could not connect" },
          { name: "Other", error: true },
        ],
      })
    );
    expect(f.map(x => x.id)).toEqual(["chain-error:Ethchain-geth", "chain-error:Other"]);
    expect(f[0].fix.to).toBe("/packages/ethchain-geth.public.dappnode.eth");
    expect(f[1]).toMatchObject({ title: "Other can't be reached", fix: { kind: "link", to: "/packages" } });
  });

  it("finds nothing for healthy or syncing entries", () => {
    expect(chainError(snapshot({ chainData: [{ name: "Nimbus", syncing: false }, { name: "Geth", syncing: true }] }))).toEqual([]);
    expect(chainError(snapshot({ chainData: null }))).toEqual([]);
  });

  it("is part of ALL_RULES", () => {
    expect(ALL_RULES).toContain(chainError);
  });
});
