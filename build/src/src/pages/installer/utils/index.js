import isIpfsHash from "utils/isIpfsHash";

// Utils

export function correctPackageName(req) {
  if (!req || typeof req !== "string") return req;
  // First determine if it contains an ipfs hash
  const hash = req.split("ipfs/")[1] || req;
  if (isIpfsHash(req)) return "/ipfs/" + hash;
  else return req;
}

export function isEmpty(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) return false;
  }
  return true;
}

export function cleanDnpName(dnpName) {
  if (!dnpName || typeof dnpName !== "string") return dnpName;
  return (dnpName || "").split("@")[0];
}
