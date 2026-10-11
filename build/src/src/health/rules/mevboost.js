import { MEVBOOST_PACKAGE } from "health/clients";
import { packageEnvs, parseRelays, mergeWithList } from "pages/packages/apps/mevboost/relayConfig";
import { BUNDLED } from "pages/packages/apps/mevboost/relayListApi";

const WHY = {
  empty: "It has no relays set, so it gets no bids for your blocks.",
  retired: "At least one of its relays is no longer running, so it waits on an answer that never comes.",
  one: "It uses only one relay, so it gets few bids for your blocks.",
  none: "None of its relays is on AVADO's list, so AVADO cannot tell whether they work.",
};

// Which sentence fits the box's RELAYS value, or null when the relays look fine.
// Matched against the relay list shipped with the Admin: health rules are
// synchronous and never fetch, so a relay retired after this build is caught
// by the Relays card on the app page, not here.
function relaysProblem(value) {
  const parsed = parseRelays(value);
  if (parsed.length === 0) return "empty";
  const onBox = mergeWithList(parsed, BUNDLED.relays).filter(r => r.checked);
  const known = onBox.filter(r => !r.custom);
  if (known.some(r => r.status === "retired")) return "retired";
  if (onBox.length === 1) return "one";
  if (known.length === 0) return "none";
  return null;
}

// Stopped on purpose: nothing to warn about. Any other state (running,
// restarting over and over, ...) still uses the relays.
const STOPPED = new Set(["exited", "dead"]);

/** MEV-Boost is not stopped and has no relays, retired relays, a single relay, or relays AVADO does not know. */
export function mevboostRelays({ packages }) {
  const pkg = (packages || []).find(p => p && p.name === MEVBOOST_PACKAGE);
  if (!pkg || STOPPED.has(pkg.state)) return [];
  const envs = packageEnvs({ ...pkg, manifest: pkg.manifest || {} });
  // No RELAYS setting at all (neither on the box nor in the manifest): nothing to judge.
  if (typeof envs.RELAYS !== "string") return [];
  const problem = relaysProblem(envs.RELAYS);
  if (!problem) return [];
  return [
    {
      id: `mevboost-relays:${problem}`,
      severity: "warning",
      topic: "setup",
      appId: MEVBOOST_PACKAGE,
      title: "MEV-Boost relays need a look",
      why: WHY[problem],
      fix: { kind: "link", to: `/packages/${MEVBOOST_PACKAGE}?tab=overview`, label: "Check relays" },
      dismissable: true,
    },
  ];
}
