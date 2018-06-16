import * as AppActions from "actions/AppActions";
import { linearRegression } from "simple-statistics";

// import the actual Api class
import Api from "@parity/api";

// @Parity, do the setup
const parityProvider = new Api.Provider.Ws(
  "ws://my.ethchain.dnp.dappnode.eth:8546"
);
const api = new Api(parityProvider);

const MIN_BLOCK_DIFF_SYNC = 10;
const INTERVAL_MS = 1000; // ms
const TRACKER_MAX_LENGTH = 60;

let ETHCHAIN_URL = "http://my.ethchain.dnp.dappnode.eth:8545";

console.log("Attempting to connect to ", ETHCHAIN_URL);

// initialize
let startTime = Date.now();

setInterval(function() {
  try {
    api.eth
      .syncing()
      .then(function(syncingInfo) {
        if (
          syncingInfo &&
          // Condition 1, big enough difference between current and highest block
          syncingInfo.highestBlock.c[0] - syncingInfo.currentBlock.c[0] >
            MIN_BLOCK_DIFF_SYNC
        ) {
          log(true, 0, trackSyncing(syncingInfo));
        } else {
          api.eth.blockNumber().then(function(blockNumber) {
            log(false, 1, "Syncronized, block: " + blockNumber);
          });
        }
      })

      .catch(function(e) {
        log(true, -1, "Error: " + e.message);
      });
  } catch (e) {
    log(true, -1, "Error: " + e.message);
  }
}, INTERVAL_MS);

function log(isSyncing, typeNum, status) {
  let type;
  if (typeNum === 1) type = "success";
  if (typeNum === 0) type = "warning";
  if (typeNum === -1) type = "danger";
  AppActions.updateStatus({
    pkg: "ethchain",
    item: "chain",
    on: typeNum,
    msg: status
  });
  if (status && status.includes("Invalid JSON RPC response")) {
    status = "Can't connect to ETHCHAIN.";
  }
  // console.log({
  //   isSyncing,
  //   type,
  //   status,
  //   syncingInfoGlobal
  // })
  AppActions.updateChainStatus({
    isSyncing,
    type,
    status
  });
}

const track = { blocks: [], chunks: [] };
function trackSyncing(syncingInfo) {
  // Parse syncing object
  const cB = syncingInfo.currentBlock.c[0];
  const hB = syncingInfo.highestBlock.c[0];
  const cC = syncingInfo.warpChunksProcessed.c[0];
  const hC = syncingInfo.warpChunksAmount.c[0];

  // Store progress
  const time = (Date.now() - startTime) / 1000; // convert to seconds
  track.blocks.push([time, cB]);
  track.chunks.push([time, cC]);
  // Clean array limiting it to 60 values
  if (track.blocks.length > TRACKER_MAX_LENGTH) track.blocks.shift();
  if (track.chunks.length > TRACKER_MAX_LENGTH) track.chunks.shift();

  // Compute slopes
  const chunksPerSecond = linearRegression(track.chunks).m;
  const blocksPerSecond = linearRegression(track.blocks).m;
  // console.log('blocksPerSecond',blocksPerSecond,'chunksPerSecond',chunksPerSecond)

  // Compare slopes
  // chunksPerSecond = 0.1 ~ 1, blocksPerSecond = 100 ~ 1000
  // OPTIONAL CONDITION syncingInfo.warpChunksAmount.c[0] == 0
  const isSnapshot = chunksPerSecond > blocksPerSecond / 1000;

  // Output for the user
  if (isSnapshot) {
    const time = Math.floor((hC - cC) / chunksPerSecond / 60);
    return (
      "Syncing from SNAPSHOT: " +
      cC +
      " / " +
      hC +
      " (" +
      Math.floor((100 * cC) / hC) +
      "%) " +
      time +
      " min remaining"
    );
  } else {
    const time = Math.floor((hB - cB) / blocksPerSecond / 60);
    return (
      "Blocks synced: " +
      cB +
      " / " +
      hB +
      " (" +
      Math.floor((100 * cB) / hB) +
      "%) " +
      time +
      " min remaining"
    );
  }
}