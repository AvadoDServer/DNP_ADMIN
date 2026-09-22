import axios from "axios";
import JsonRpcClient from "react-jsonrpc-client";

const IPFS_GATEWAY = "http://ipfs.my.ava.do:8080/ipfs/";
const IPFS_API = "http://ipfs.my.ava.do:5001/api/v0/swarm/connect?arg=";
const RPC_TIMEOUT_MS = 20000;

function peerConnect(peer) {
  axios.post(IPFS_API + peer).catch(e => console.log(`Failed to connect to ${peer}`, e.message));
}

// react-jsonrpc-client's request() has no timeout option of its own (it's a
// bare `fetch` under the hood with no way to pass a signal in), so an
// unreachable rpc.ava.do would hang this call forever. Race it against a
// timer instead, matching the IPFS gateway request's own 20s axios timeout.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(Error(`store.getUpdates timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The DappStore catalogue for this box: rpc.ava.do decides which store
 * (production or staging) the node sees, the catalogue itself comes from IPFS.
 * Rejects when either step fails, e.g. when the box has no internet.
 */
export async function fetchStore({ nodeid, packages, storeHash }) {
  const api = new JsonRpcClient({ endpoint: "https://rpc.ava.do" });
  const response = await withTimeout(
    api.request("store.getUpdates", {
      nodeid,
      packages: (packages || []).map(p => ({ name: p.name, version: p.version })),
    }),
    RPC_TIMEOUT_MS
  );
  const storeRes = JSON.parse(response);
  (storeRes.ipfsHostNodes || []).forEach(peerConnect);
  const hash = storeHash || storeRes.hash;
  const res = await axios.get(IPFS_GATEWAY + hash, { timeout: RPC_TIMEOUT_MS });
  (res.data.ipfsHostNodes || []).forEach(peerConnect);
  return res.data;
}
