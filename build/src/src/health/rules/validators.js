import { getClient, keyHolders, NETWORKS } from "health/clients";
import { appTitle } from "./apps";

// What the owner can do about a missing fee recipient. Shared with the same
// finding when AVADO Care reports it (health/careFindings.js), whose status
// carries no steps of its own.
export const FEE_RECIPIENT_STEPS = [
  "Open the app and set your Ethereum address as the fee recipient in its settings.",
  "If these are Rocket Pool validators, open Rocket Pool: it sets the fee recipient for its validators.",
  "AVADO checks this again within the hour.",
];

// Validators that propose a block send its transaction fees to their fee
// recipient. `feeRecipients` (health/feeRecipients.js) only lists clients it
// could read; a client it could not read gives no finding.
export function feeRecipientMissing({ packages, feeRecipients }) {
  return Object.entries(feeRecipients || {})
    .filter(([, r]) => r && r.validators > 0 && r.missing > 0)
    .map(([name, r]) => {
      const pkg = (packages || []).find(p => p && p.name === name);
      const client = getClient(name);
      const label = pkg ? appTitle(pkg) : (client && client.label) || name.split(".")[0];
      const sampled = r.checked < r.validators ? ` (checked ${r.checked} of ${r.validators})` : "";
      return {
        id: `fee-recipient-missing:${name}`,
        severity: "critical",
        topic: "setup",
        appId: name,
        title: `Validators in ${label} have no fee recipient`,
        why: "When a validator proposes a block, the block's transaction fees go to its fee recipient. Without one, your validators lose those rewards.",
        detail: `${r.missing} validator${r.missing === 1 ? "" : "s"} without a fee recipient${sampled}`,
        fix: { kind: "link", to: `/packages/${name}`, label: "Open the app" },
        steps: FEE_RECIPIENT_STEPS,
      };
    });
}
feeRecipientMissing.needs = "feeRecipients";

// How long to wait between removing validators from one app and importing
// them into another. docs.ava.do ("Switching from Prysm to Teku, etc.") asks
// for at least 5 finalized epochs (about 32 minutes on mainnet) and
// recommends 10 to be completely safe: 10 × 6.4 minutes = 64, rounded up.
export const KEY_MOVE_WAIT_MINUTES = 70;

export const SWITCHING_CLIENTS_DOCS = "https://docs.ava.do/quick-help/switching-from-prysm-to-teku-etc.";

// Shared with the installer's confirm before a second validator app
// (pages/installer/components/confirmSecondValidatorApp.js).
export const ONE_APP_PER_KEY =
  "Each validator key must run in one app only. If the same key runs in two apps, it gets slashed: the validator loses ETH and is forced out of staking for good.";

// The safe order for moving validators to another app. Never "stop the old
// app": every validator app has restart "always", and an update starts it
// again, so a stopped app comes back with the keys still in it.
export const TWO_VALIDATOR_APPS_STEPS = [
  "Open the app you are moving away from and remove your validators there. Keep the slashing-protection file it gives you. Stopping the app is not enough: it starts again by itself.",
  `Wait at least ${KEY_MOVE_WAIT_MINUTES} minutes.`,
  "Import your validators into the app you keep, with that file. Rocket Pool validators: pick the new app in Rocket Pool's settings and follow its prompts.",
  "When they run there, remove the old app in My DApps.",
];

// "Nimbus and Teku", "Nimbus, Teku and Lighthouse"
export const joinNames = names =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

// Two apps that can hold validator keys on one network. The same key signing
// in both gets the validator slashed. This stays a warning: installed apps
// cannot tell duplicate keys from keys deliberately split between two apps
// (or Rocket Pool keys next to solo keys), so the owner can hide it. Stopped
// apps count (see keyHolders).
export function twoValidatorClients({ packages }) {
  const byNetwork = new Map();
  for (const item of keyHolders(packages)) {
    const list = byNetwork.get(item.client.network) || [];
    byNetwork.set(item.client.network, [...list, item]);
  }
  return [...byNetwork.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([network, list]) => {
      const names = joinNames(list.map(({ pkg }) => appTitle(pkg)));
      const networkLabel = (NETWORKS[network] && NETWORKS[network].label) || network;
      return {
        id: `two-validator-clients:${network}`,
        severity: "warning",
        topic: "setup",
        title: `${names} are ${list.length === 2 ? "both" : "all"} installed for ${networkLabel}`,
        why: `${ONE_APP_PER_KEY} If each app has different keys, or one has none left, you can hide this.`,
        fix: { kind: "steps", label: "How to move validators safely" },
        steps: TWO_VALIDATOR_APPS_STEPS,
        learnMore: SWITCHING_CLIENTS_DOCS,
        dismissable: true,
      };
    });
}
