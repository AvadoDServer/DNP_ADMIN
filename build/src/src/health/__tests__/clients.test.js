import { getClient, clientsByRole, keyHolders, currentSlot, ROLES, NETWORKS } from "health/clients";

describe("client table", () => {
  it("knows the AVADO mainnet clients from the store", () => {
    expect(getClient("nimbus.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "mainnet", promClient: "nimbus" });
    expect(getClient("teku.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "mainnet" });
    // AVADO-DNP-Prometheus labels the Lighthouse target { client: lighthouse, network: mainnet }
    expect(getClient("lighthouse.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "mainnet", promClient: "lighthouse" });
    expect(getClient("ethchain-geth.public.dappnode.eth")).toMatchObject({ role: ROLES.EXECUTION, network: "mainnet", canResetData: true });
    expect(getClient("avado-dnp-nethermind.public.dappnode.eth")).toMatchObject({ role: ROLES.EXECUTION, network: "mainnet" });
    expect(getClient("grafana.avado.dappnode.eth")).toMatchObject({ role: ROLES.MONITORING });
    expect(getClient("mevboost.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.MEV, network: "mainnet" });
  });

  it("never offers a data reset for consensus clients (validator keys live there)", () => {
    for (const name of ["nimbus.avado.dnp.dappnode.eth", "teku.avado.dnp.dappnode.eth", "lighthouse.avado.dnp.dappnode.eth", "eth2validator.avado.dnp.dappnode.eth"])
      expect(getClient(name).canResetData).toBe(false);
  });

  it("knows which apps can hold validator keys: every consensus package except Prysm's beacon chain", () => {
    for (const name of [
      "nimbus.avado.dnp.dappnode.eth",
      "nimbus-holesky.avado.dnp.dappnode.eth",
      "teku.avado.dnp.dappnode.eth",
      "teku-holesky.avado.dnp.dappnode.eth",
      "teku-gnosis.avado.dnp.dappnode.eth",
      "lighthouse.avado.dnp.dappnode.eth",
      "lighthouse-holesky.avado.dnp.dappnode.eth",
      "lighthouse-gnosis.avado.dnp.dappnode.eth",
      "eth2validator.avado.dnp.dappnode.eth",
    ])
      expect(getClient(name).holdsKeys, name).toBe(true);
    for (const name of ["prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth", "ethchain-geth.public.dappnode.eth", "mevboost.avado.dnp.dappnode.eth", "grafana.avado.dappnode.eth"])
      expect(getClient(name).holdsKeys, name).toBe(false);
  });

  it("knows Lighthouse on Holesky and Gnosis, labelled like the Prometheus lighthouse job", () => {
    expect(getClient("lighthouse-holesky.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "holesky", promClient: "lighthouse", canResetData: false });
    expect(getClient("lighthouse-gnosis.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "gnosis", promClient: "lighthouse", canResetData: false });
  });

  it("keyHolders lists installed key-holding apps, stopped ones too, and skips retired networks", () => {
    const packages = [
      { name: "nimbus.avado.dnp.dappnode.eth", state: "running" },
      { name: "teku.avado.dnp.dappnode.eth", state: "exited", running: false },
      { name: "prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth" },
      { name: "ethchain-geth.public.dappnode.eth" },
      { name: "teku-prater.avado.dnp.dappnode.eth" },
      { name: "unknown.dnp.dappnode.eth" },
    ];
    expect(keyHolders(packages).map(k => k.pkg.name)).toEqual(["nimbus.avado.dnp.dappnode.eth", "teku.avado.dnp.dappnode.eth"]);
    expect(NETWORKS.goerli.retired).toBe(true);
    expect(keyHolders(undefined)).toEqual([]);
  });

  it("returns null for unknown packages", () => {
    expect(getClient("my-custom.public.dappnode.eth")).toBeNull();
    expect(getClient(undefined)).toBeNull();
  });

  it("filters installed packages by role", () => {
    const packages = [
      { name: "nimbus.avado.dnp.dappnode.eth" },
      { name: "grafana.avado.dappnode.eth" },
      { name: "unknown.dnp.dappnode.eth" },
    ];
    const cc = clientsByRole(packages, ROLES.CONSENSUS);
    expect(cc).toHaveLength(1);
    expect(cc[0].pkg.name).toBe("nimbus.avado.dnp.dappnode.eth");
  });

  it("computes the current mainnet slot from the wall clock", () => {
    // 1790103551 s → slot 15 273 294 on mainnet (verified against the test box)
    expect(currentSlot("mainnet", 1790103551 * 1000)).toBe(15273294);
    expect(currentSlot("nowhere", Date.now())).toBeNull();
    expect(NETWORKS.gnosis.slotSeconds).toBe(5);
  });

  it("mirrors the store's ETH STAKING category: every listed package is a known execution or consensus client", () => {
    // Verified against the live DappStore's ETH STAKING category on 2026-09-22.
    const ethStakingPackages = [
      "teku.avado.dnp.dappnode.eth",
      "ethchain-geth.public.dappnode.eth",
      "eth2validator.avado.dnp.dappnode.eth",
      "avado-dnp-nethermind.public.dappnode.eth",
      "nimbus.avado.dnp.dappnode.eth",
    ];
    for (const name of ethStakingPackages) {
      const client = getClient(name);
      expect(client, `expected ${name} to be a known client`).not.toBeNull();
      expect([ROLES.EXECUTION, ROLES.CONSENSUS]).toContain(client.role);
      expect(client.network).toBe("mainnet");
    }
  });
});
