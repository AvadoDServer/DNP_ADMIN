/**
 * The DappStore catalogue's manifest hash for a package name, or null.
 *
 * Opening the installer by name (/installer/admin.dnp.dappnode.eth) makes the
 * DAPPMANAGER resolve the name through ENS, which needs an Ethereum execution
 * client — most boxes don't have one. The store catalogue (from rpc.ava.do)
 * already carries each package's IPFS hash, the same one the DappStore cards
 * open, so name links are sent there instead.
 *
 * Only plain names are looked up: ids with a version ("name@1.2.3") or IPFS
 * hashes are left alone.
 */
export function storeHashFor(id, storePackages) {
  if (typeof id !== "string" || !id.endsWith(".eth") || id.includes("@") || id.includes("ipfs")) return null;
  const entry = (storePackages || []).find(p => p && p.manifest && p.manifest.name === id && p.manifesthash);
  return entry ? entry.manifesthash : null;
}

/** True for ids the store catalogue could translate (plain .eth names). */
export function isPlainName(id) {
  return typeof id === "string" && id.endsWith(".eth") && !id.includes("@") && !id.includes("ipfs");
}
