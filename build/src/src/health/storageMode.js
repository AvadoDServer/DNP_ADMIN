import semver from "semver";
import { getClient, ROLES } from "./clients";

// How much chain history a consensus client keeps, in plain words. Admin
// only (it uses semver, so AVADO Care's byte-for-byte copy of clients.js and
// the rules does not take it). Derived from the package's own settings
// (`pkg.envs`) and, for Teku, its version: the 0.0.76 package template
// switched Teku's default to "minimal".
const LABELS = {
  minimal: "Recent data only (minimal)",
  pruned: "All blocks (pruned)",
  archive: "Full history (archive)",
};

// Teku's package template default changed in this version.
export const TEKU_MINIMAL_SINCE = "0.0.76";

const result = (key, detail) => ({ key, label: LABELS[key], detail });
const env = (pkg, name) => {
  const v = pkg && pkg.envs && pkg.envs[name];
  return typeof v === "string" ? v : "";
};

function teku(pkg) {
  const m = env(pkg, "EXTRA_OPTS").match(/--data-storage-mode(?:=|\s+)(archive|prune|minimal)\b/i);
  if (m) {
    const mode = m[1].toLowerCase();
    return result(mode === "prune" ? "pruned" : mode, "Set by EXTRA_OPTS");
  }
  const v = semver.valid(semver.coerce(pkg && pkg.version));
  return v && semver.gte(v, TEKU_MINIMAL_SINCE)
    ? result("minimal", `Teku default for package ${TEKU_MINIMAL_SINCE} and newer`)
    : result("pruned", `Teku default for packages older than ${TEKU_MINIMAL_SINCE}`);
}

const flagged = (pkg, envName, flagRegex, flag, detailDefault) =>
  flagRegex.test(env(pkg, envName)) ? result("archive", `Set by ${envName} (${flag})`) : result("pruned", detailDefault);

/** @returns {{ key: "minimal"|"pruned"|"archive", label: string, detail: string } | null} null for anything but a consensus client. */
export function storageMode(pkg) {
  const client = getClient(pkg && pkg.name);
  if (!client || client.role !== ROLES.CONSENSUS) return null;
  switch (client.promClient) {
    case "teku":
      return teku(pkg);
    case "lighthouse":
      return flagged(pkg, "EXTRA_OPTS_BEACON_NODE", /--reconstruct-historic-states/, "--reconstruct-historic-states", "Lighthouse default: old states are pruned");
    case "nimbus":
      return flagged(pkg, "EXTRA_OPTS", /--history[=\s]+archive\b/i, "--history=archive", "Nimbus default: history is pruned");
    case "prysm":
      return flagged(pkg, "EXTRA_OPTS", /--slots-per-archive-point/, "--slots-per-archive-point", "Prysm default: no archive points");
    default:
      return null;
  }
}
