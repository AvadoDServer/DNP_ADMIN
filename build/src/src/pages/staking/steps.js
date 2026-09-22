import { clientsByRole, ROLES, GRAFANA_PACKAGE } from "health/clients";

export function stakingSteps(packages, manual = {}) {
  const has = role => clientsByRole(packages, role).filter(x => x.client.network === "mainnet" || role === ROLES.MONITORING);
  const cc = has(ROLES.CONSENSUS)[0];
  const ccSetup = cc ? { label: `Open ${cc.client.label} setup`, to: `/packages/${cc.pkg.name}?tab=setup` } : null;
  const installed = name => (packages || []).some(x => x.name === name);
  return [
    { id: "execution", title: "Install an execution client", why: "It follows the Ethereum chain. Geth and Nethermind are available.", auto: true,
      state: has(ROLES.EXECUTION).length ? "done" : "todo", action: { label: "Choose one", to: "/installer?category=ethstaking" } },
    { id: "consensus", title: "Install a consensus client", why: "It follows the beacon chain and runs your validators. Nimbus, Teku and Prysm are available.", auto: true,
      state: cc ? "done" : "todo", action: { label: "Choose one", to: "/installer?category=ethstaking" } },
    { id: "keys", title: "Import your validator keys", why: "Import each key on this AVADO only. The same key running on two machines gets slashed.", auto: false,
      state: manual.keys ? "done" : "todo", action: ccSetup },
    { id: "feeRecipient", title: "Set your fee recipient", why: "The address that receives transaction tips from the blocks you propose.", auto: false,
      state: manual.feeRecipient ? "done" : "todo", action: ccSetup },
    { id: "mev", title: "Add MEV-Boost", why: "Optional. Earns more from the blocks you propose.", auto: true,
      state: installed("mevboost.avado.dnp.dappnode.eth") ? "done" : "optional", action: { label: "Install MEV-Boost", to: "/installer/mevboost.avado.dnp.dappnode.eth" } },
    { id: "monitoring", title: "Add monitoring", why: "Optional. Dashboards, and warnings about missed attestations on Home.", auto: true,
      state: installed(GRAFANA_PACKAGE) ? "done" : "optional", action: { label: "Install monitoring", to: `/installer/${GRAFANA_PACKAGE}` } },
  ];
}
