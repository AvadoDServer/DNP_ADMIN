// Services
import { mountPoint as chainDataMountPoint } from "services/chainData/data";
import { mountPoint as connectionStatusMountPoint } from "services/connectionStatus/data";
import { mountPoint as coreUpdateMountPoint } from "services/coreUpdate/data";
import { mountPoint as dappnodeStatusMountPoint } from "services/dappnodeStatus/data";
import { mountPoint as devicesMountPoint } from "services/devices/data";
import { mountPoint as dnpDirectoryMountPoint } from "services/dnpDirectory/data";
import { mountPoint as dnpInstalledMountPoint } from "services/dnpInstalled/data";
import { mountPoint as isInstallingLogsMountPoint } from "services/isInstallingLogs/data";
import { mountPoint as loadingStatusMountPoint } from "services/loadingStatus/data";
import { mountPoint as notificationsMountPoint } from "services/notifications/data";
import { mountPoint as userActionLogsMountPoint } from "services/userActionLogs/data";
// MEV-Boost: its manifest defaults are the recommended live relays and no minimum (package 0.0.19).
import relayList from "pages/packages/apps/mevboost/relays.bundled.json";

const relayUrl = id => relayList.relays.find(r => r.id === id).url;
const mevBoostDefaultRelays = relayList.relays
  .filter(r => r.recommended && r.status === "live")
  .map(r => r.url)
  .join(",");

// Lost data: Rocket Pool came up after an update with empty storage while its
// wallet is still in an old volume (DAPPMANAGER 10.0.51 listLostData /
// findLostData). Served by pages/packages/lostDataApi.js in mock mode: Home
// shows "Rocket Pool has data in an unused storage volume", and the Rocket
// Pool app page shows the "Recover data" card with one volume to recover and
// one recovered earlier. Recovering succeeds after 2 s with 2 files kept and
// the wallet warning; the volume then moves to `recovered` (until reload).
// Needs the DAPPMANAGER 10.0.51 core package below.
export const mockLostData = [
  {
    package: "rocketpool.avado.dnp.dappnode.eth",
    title: "Rocket Pool",
    live: [{ name: "rocketpoolavadodnpdappnodeeth_rocketpool", mountPath: "/rocketpool" }],
    candidates: [
      {
        name: "rocketpool-avado-dnp-dappnode-eth_rocketpool",
        anonymous: false,
        createdAt: "2024-11-18T09:12:44Z",
        entries: [".rocketpool", "data", "user-settings.yml"],
        sizeKb: 1843200,
        target: "rocketpoolavadodnpdappnodeeth_rocketpool",
        confidence: "high",
      },
      {
        // Low confidence: an anonymous volume that only looks like Rocket
        // Pool's data (caution line, secondary button; never on Home).
        name: "9d41f0c27a6e" + "1".repeat(52),
        anonymous: true,
        createdAt: null,
        entries: ["data"],
        sizeKb: 5120,
        target: "rocketpoolavadodnpdappnodeeth_rocketpool",
        confidence: "low",
      },
    ],
    recovered: [{ volume: "3f9c2a7be14d" + "0".repeat(52), at: "2025-06-02T08:00:00Z" }],
  },
];

// Scenarios for `yarn dev`: open the Admin with ?mock=<name> (in the address
// before the #, or after it). Known: "ipfs-restarting", "teku-down" (the
// diagnostics of ticket-0928, see pages/troubleshoot/diagnosticsApi.js).
export function mockScenario() {
  if (typeof window === "undefined" || !window.location) return null;
  const { search = "", hash = "" } = window.location;
  const fromHash = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
  return new URLSearchParams(search).get("mock") || new URLSearchParams(fromHash).get("mock") || null;
}

// IPFS health (DAPPMANAGER 10.0.52 getIpfsHealth), served by
// pages/system/ipfsResetApi.js in mock mode. "ipfs-restarting": IPFS is in a
// crash loop on a damaged repo, so Home shows "IPFS keeps restarting" with
// "Reset IPFS storage"; the reset succeeds after 3 s (1.3 GB removed) and IPFS
// is healthy until reload. Otherwise IPFS is healthy; System > Storage always
// has the button.
export function mockIpfsHealth(scenario) {
  if (scenario === "ipfs-restarting")
    return {
      exists: true,
      running: false,
      restarting: true,
      restartCount: 41,
      restartsLastHour: 6,
      startedAt: "2026-10-13T08:00:00Z",
      lastLogLines: [
        "Found IPFS fs-repo at /data/ipfs",
        "Error: failed to open datastore: leveldb: manifest corrupted (field 'comparer'): missing [file=MANIFEST-000123]",
      ],
    };
  return {
    exists: true,
    running: true,
    restarting: false,
    restartCount: 0,
    restartsLastHour: 0,
    startedAt: "2026-10-13T08:00:00Z",
    lastLogLines: [],
  };
}

export const mockState = {
  /* chainData */
  [chainDataMountPoint]: [],

  /* connectionStatus */
  [connectionStatusMountPoint]: {
    isOpen: true,
    session: {},
  },

  /* coreUpdate */
  [coreUpdateMountPoint]: {
    coreDeps: {
      "admin.dnp.dappnode.eth": { version: "0.2.1" },
      "vpn.dnp.dappnode.eth": { version: "0.2.1" },
    },
    coreManifest: {
      version: "0.2.1",
      changelog:
        "Major improvements to the 0.2 version https://github.com/dappnode/DAppNode/wiki/DAppNode-Migration-guide-to-OpenVPN",
      warnings: {
        onInstall: "Your VPN will be restarted and you may lose connection",
      },
    },
  },

  /* dappnodeStatus */
  [dappnodeStatusMountPoint]: {
    params: {},
    stats: {
      cpu: "35%",
      memory: "46%",
      memTotal: "16.00 GB",
      memUsed: "7.36 GB",
      disk: "57%",
      diskTotal: "1.50 TB",
      diskUsed: "0.86 TB",
    },
    diagnose: {},
    pingReturns: {},
    ipfsConnectionStatus: {},
  },

  /* devices */
  [devicesMountPoint]: [
    { id: "test-name", isAdmin: true },
    { id: "other-user", isAdmin: false, url: "link-to-otp/?id=617824#hdfuisf" },
  ],

  /* dnpDirectory */
  [dnpDirectoryMountPoint]: {
    "bitcoin.dnp.dappnode.eth": {
      name: "bitcoin.dnp.dappnode.eth",
      whitelisted: true,
      manifest: { name: "bitcoin.dnp.dappnode.eth" },
      avatar: "https://en.bitcoin.it/w/images/en/2/29/BC_Logo_.png",
    },
    "ln.dnp.dappnode.eth": {
      name: "ln.dnp.dappnode.eth",
      whitelisted: true,
      manifest: { name: "ln.dnp.dappnode.eth", version: "0.1.0" },
    },
  },

  /* dnpInstalled */
  [dnpInstalledMountPoint]: [
    {
      name: "admin.dnp.dappnode.eth",
      isCore: true,
      state: "exited",
    },
    {
      // 10.0.53: has the lost-data calls (see mockLostData above), the
      // IPFS reset (mockIpfsHealth) and getDiagnostics (the report).
      name: "dappmanager.dnp.dappnode.eth",
      isCore: true,
      isDnp: true,
      version: "10.0.53",
      state: "running",
      running: true,
    },
    {
      // IPFS: its health comes from mockIpfsHealth (?mock=ipfs-restarting).
      name: "ipfs.dnp.dappnode.eth",
      isCore: true,
      version: "10.0.7",
      state: "running",
      running: true,
      volumes: [{ name: "dncore_ipfsdnpdappnodeeth_data", path: "/data/ipfs", size: "1.3GB" }],
      manifest: { name: "ipfs.dnp.dappnode.eth", version: "10.0.7", title: "AVADO IPFS node" },
    },
    {
      // Lost data: its wallet sits in an unused storage volume (mockLostData).
      name: "rocketpool.avado.dnp.dappnode.eth",
      isDnp: true,
      isCore: false,
      version: "1.0.4",
      state: "running",
      running: true,
      ports: [],
      volumes: [{ name: "rocketpoolavadodnpdappnodeeth_rocketpool", path: "/rocketpool", size: "0B" }],
      manifest: { name: "rocketpool.avado.dnp.dappnode.eth", version: "1.0.4", title: "Rocket Pool" },
    },
    {
      name: "ln.dnp.dappnode.eth",
      isDnp: true,
      version: "0.1.0",
      state: "running",
    },
    {
      // The Relays card: one live relay, one that has shut down, one custom, and a minimum bid.
      name: "mevboost.avado.dnp.dappnode.eth",
      isDnp: true,
      version: "0.0.19",
      state: "running",
      envs: {
        NETWORK: "mainnet",
        RELAYS: [relayUrl("ultrasound"), relayUrl("bloxroute-ethical"), "https://0x" + "e".repeat(96) + "@my.custom.relay"].join(","),
        EXTRA_OPTS: "-min-bid 0.05",
      },
      manifest: {
        name: "mevboost.avado.dnp.dappnode.eth",
        version: "0.0.19",
        image: { environment: ["NETWORK=mainnet", `RELAYS=${mevBoostDefaultRelays}`, "EXTRA_OPTS="] },
      },
    },
  ],

  /* isInstallingLogs */
  [isInstallingLogsMountPoint]: {
    /* Core update */
    "core.dnp.dappnode.eth": {
      id: "834d5e59-664b-46b9-8906-fbc5341d1acf",
      log: "Downloading 54%",
    },
    "vpn.dnp.dappnode.eth": {
      id: "834d5e59-664b-46b9-8906-fbc5341d1acf",
      log: "Downloading 54%",
    },
    "admin.dnp.dappnode.eth": {
      id: "834d5e59-664b-46b9-8906-fbc5341d1acf",
      log: "Loading...",
    },
    /* Regular install of non-core*/
    "bitcoin.dnp.dappnode.eth": {
      id: "834d5e59-664b-46b9-8906-fbc5341d1acf",
      log: "Downloading 87%",
    },
  },

  /* loadingStatus */
  [loadingStatusMountPoint]: {},

  /* notifications */
  [notificationsMountPoint]: {
    "diskSpaceRanOut-stoppedPackages": {
      id: "diskSpaceRanOut-stoppedPackages",
      type: "danger",
      title: "Disk space ran out, stopped packages",
      body: "Available disk space gone wrong ".repeat(10),
      timestamp: 153834824,
      viewed: false,
      fromDappmanager: true,
    },
  },

  /* userActionLogs */
  [userActionLogsMountPoint]: [
    {
      event: "installPackage.dappmanager.dnp.dappnode.eth",
      kwargs: {
        id: "rinkeby.dnp.dappnode.eth",
        userSetVols: {},
        userSetPorts: {},
        options: {},
      },
      level: "error",
      message: "Timeout to cancel expired",
      name: "Error",
      stack: "Error: Timeout to cancel expired↵  ...",
      timestamp: "2019-02-01T19:09:16.503Z",
    },
  ],
};
