import { clientsByRole, ROLES, NETWORKS, PROMETHEUS_PACKAGE } from "health/clients";

const networksOf = list => new Set(list.map(({ client }) => client.network));

export function consensusWithoutExecution({ packages }) {
  const cc = clientsByRole(packages, ROLES.CONSENSUS);
  const ecNetworks = networksOf(clientsByRole(packages, ROLES.EXECUTION));
  const seen = new Set();
  return cc
    .filter(({ client }) => !ecNetworks.has(client.network))
    .filter(({ client }) => !seen.has(client.network) && seen.add(client.network))
    .map(({ pkg, client }) => ({
      id: `consensus-without-execution:${client.network}`,
      severity: "critical",
      topic: "setup",
      appId: pkg.name,
      title: `${client.label} has no execution client`,
      why: `A consensus client needs an execution client on ${NETWORKS[client.network]?.label || client.network} to follow the chain. Until you install one, it cannot attest and your validators miss rewards.`,
      fix: { kind: "link", to: "/installer?category=ethstaking", label: "Install an execution client" },
      learnMore: "https://docs.ava.do",
    }));
}

export function executionWithoutConsensus({ packages }) {
  const ec = clientsByRole(packages, ROLES.EXECUTION);
  const ccNetworks = networksOf(clientsByRole(packages, ROLES.CONSENSUS));
  return ec
    .filter(({ client }) => !ccNetworks.has(client.network))
    .map(({ pkg, client }) => ({
      id: `execution-without-consensus:${client.network}`,
      severity: "warning",
      topic: "setup",
      appId: pkg.name,
      title: `${client.label} has no consensus client`,
      why: "Since the Merge an execution client cannot follow the chain on its own. Install a consensus client for the same network.",
      fix: { kind: "link", to: "/installer?category=ethstaking", label: "Install a consensus client" },
    }));
}

export function monitoringMissing({ packages }) {
  const hasConsensus = clientsByRole(packages, ROLES.CONSENSUS).length > 0;
  const hasPrometheus = (packages || []).some(p => p && p.name === PROMETHEUS_PACKAGE);
  if (!hasConsensus || hasPrometheus) return null;
  return {
    id: "monitoring-missing",
    severity: "info",
    topic: "attestations",
    title: "Install monitoring to check missed attestations",
    why: "The monitoring package records your clients' metrics, so your AVADO can warn you about missed attestations, low peers or falling behind the chain.",
    fix: { kind: "link", to: "/installer/grafana.avado.dappnode.eth", label: "Install monitoring" },
    dismissable: true,
  };
}
