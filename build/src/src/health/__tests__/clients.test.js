import { getClient, clientsByRole, currentSlot, ROLES, NETWORKS } from "health/clients";

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
