import axios from "axios";
import JsonRpcClient from "react-jsonrpc-client";

const IPFS_GATEWAY = "http://ipfs.my.ava.do:8080/ipfs/";
const IPFS_API = "http://ipfs.my.ava.do:5001/api/v0/swarm/connect?arg=";

function peerConnect(peer) {
  axios.post(IPFS_API + peer).catch(e => console.log(`Failed to connect to ${peer}`, e.message));
}

/**
 * The DappStore catalogue for this box: rpc.ava.do decides which store
 * (production or staging) the node sees, the catalogue itself comes from IPFS.
 * Rejects when either step fails, e.g. when the box has no internet.
 */
export async function fetchStore({ nodeid, packages, storeHash }) {
  const api = new JsonRpcClient({ endpoint: "https://rpc.ava.do" });
  const response = await api.request("store.getUpdates", {
    nodeid,
    packages: (packages || []).map(p => ({ name: p.name, version: p.version })),
  });
  const storeRes = JSON.parse(response);
  (storeRes.ipfsHostNodes || []).forEach(peerConnect);
  const hash = storeHash || storeRes.hash;
  const res = await axios.get(IPFS_GATEWAY + hash, { timeout: 20000 });
  (res.data.ipfsHostNodes || []).forEach(peerConnect);
  return res.data;
}
