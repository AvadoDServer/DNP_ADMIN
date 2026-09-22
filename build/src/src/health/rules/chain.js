import { clientsByRole, currentSlot, NETWORKS, ROLES } from "health/clients";
import { appTitle } from "./apps";

/** Installed consensus client packages matched to a metric sample. */
function matchSamples(packages, samples) {
  const cc = clientsByRole(packages, ROLES.CONSENSUS);
  return (samples || [])
    .map(s => ({ s, match: cc.find(({ client }) => client.promClient === s.client && client.network === s.network) }))
    .filter(x => x.match);
}

export function chainSyncing({ chainData }) {
  return (chainData || [])
    .filter(c => c && c.syncing)
    .map(c => {
      const pct = typeof c.progress === "number" ? ` (${Math.floor(c.progress * 100)}%)` : "";
      return {
        id: `chain-syncing:${c.name}`,
        severity: "info",
        topic: "sync",
        title: `${c.name} is syncing${pct}`,
        why: "Your client is catching up with the chain. Validators can only attest once it is synced.",
        fix: null,
      };
    });
}

export function headBehind({ packages, metrics, now }) {
  if (!metrics) return [];
  return matchSamples(packages, metrics.headSlot)
    .map(({ s, match }) => {
      const wall = currentSlot(s.network, now);
      const n = NETWORKS[s.network];
      if (wall === null || wall - s.value <= 2 * n.slotsPerEpoch) return null;
      return {
        id: `head-behind:${match.pkg.name}`,
        severity: "warning",
        topic: "sync",
        appId: match.pkg.name,
        title: `${appTitle(match.pkg)} is ${wall - s.value} slots behind the chain`,
        why: "It is not keeping up with the network, so your validators may miss attestations.",
        fix: { kind: "steps", label: "What to check" },
        steps: [
          "Check that your execution client is running and synced.",
          "Check the peer count: fewer than 10 peers makes a client fall behind.",
          "Restart the client; if it falls behind again, open its logs.",
        ],
      };
    })
    .filter(Boolean);
}

export function lowPeers({ packages, metrics }) {
  if (!metrics) return [];
  return matchSamples(packages, metrics.peers)
    .filter(({ s }) => s.value < 10)
    .map(({ s, match }) => ({
      id: `low-peers:${match.pkg.name}`,
      severity: "warning",
      topic: "sync",
      appId: match.pkg.name,
      title: `${appTitle(match.pkg)} has only ${s.value} peers`,
      why: "With few peers your client hears about new blocks late and can fall behind or miss attestations.",
      fix: { kind: "link", to: "/help/access", label: "Improve connectivity" },
    }));
}

export function missedAttestations({ packages, metrics }) {
  if (!metrics) return [];
  return matchSamples(packages, metrics.attesterMiss)
    .filter(({ s }) => s.value >= 1)
    .map(({ s, match }) => {
      const hit = (metrics.attesterHit || []).find(h => h.client === s.client && h.network === s.network);
      const total = s.value + ((hit && hit.value) || 0);
      const missed = Math.round(s.value);
      return {
        id: `missed-attestations:${match.pkg.name}`,
        severity: total > 0 && s.value / total > 0.5 ? "critical" : "warning",
        topic: "attestations",
        appId: match.pkg.name,
        title: `${missed} attestation${missed === 1 ? "" : "s"} missed in the last hour`,
        why: "Each missed attestation costs a small reward. A few are normal; a steady stream means something needs fixing.",
        fix: { kind: "link", to: "/help/attestations", label: "Find the cause" },
      };
    });
}

// These three rules can only evaluate anything with a metrics sample; when
// metrics are unavailable they return `[]`, which would otherwise be
// indistinguishable from "checked, found nothing wrong". `needs = "metrics"`
// tells runChecksDetailed to skip (not count) them while metrics is null.
headBehind.needs = "metrics";
lowPeers.needs = "metrics";
missedAttestations.needs = "metrics";
