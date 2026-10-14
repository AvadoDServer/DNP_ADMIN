// getDiagnostics answers (DAPPMANAGER 10.0.53), hand-written to the contract
// in the DAPPMANAGER's calls/getDiagnostics.js, for tests and `yarn dev`
// (pages/troubleshoot/diagnosticsApi.js serves them in mock mode).
//
// ticket0928: replays the box of support ticket 0928 (2026-10-14). Its
// installed apps, versions and recent activity are the ones of the real
// report; the diagnostics are what that box would have answered: Teku's
// container up but its program FATAL after the checkpoint download failed,
// the box on Wi-Fi with no Ethernet link, IPFS connected to no AVADO store
// node so "Can't check for updates". Not captured from the box.
//
// healthy: a Nimbus + Nethermind box on Ethernet where everything works.
//
// The DAPPMANAGER side (10.0.53): `status` is docker ps's text; supervisord's
// STOPPING comes as state UNKNOWN with "STOPPING …"; Teku, Nimbus and
// Lighthouse are role "beacon" with `validators: { count }` (beacon and
// validator in one package); Prysm's eth2validator is role "validator" with
// `api: { reachable }` only; a package without an AVADO settings file has
// `settings: null`; a package outside the client table (Geth today) has no
// `clients` entry but still its container, programs and logs.
//
// Both plant secrets (a password in a log line, a password key in settings,
// a mnemonic) that must never reach the report.

export const PLANTED_SECRETS = ["PlantedSecret123", "PlantedSecret456", "abandon ability able about above absent"];

const NOW = new Date("2026-10-14T11:45:40.240Z");

const pkg = (name, version, title, { isCore = false, size = 0 } = {}) => ({
  name,
  id: name,
  version,
  state: "running",
  running: true,
  isCore,
  volumes: size ? [{ name: `${name}_data`, size }] : [],
  manifest: { name, version, title },
});

const container = (id, overrides = {}) => {
  const core = Boolean(overrides.isCore);
  return {
    name: `${core ? "DAppNodeCore" : "DAppNodePackage"}-${id}`,
    id,
    isCore: core,
    image: `${id}:${overrides.version || "1.0.0"}`,
    version: "1.0.0",
    state: "running",
    status: "Up 5 days",
    exitCode: 0,
    oomKilled: false,
    restartCount: 0,
    startedAt: "2026-10-09T08:12:03.000Z",
    finishedAt: "0001-01-01T00:00:00Z",
    uptimeSeconds: 444217,
    health: null,
    processes: [],
    log: { lines: [], errors: [], errorCount: 0 },
    settings: null,
    ...overrides,
  };
};

/* ---------------- ticket 0928 ---------------- */

const TEKU = "teku.avado.dnp.dappnode.eth";
const NETHERMIND = "avado-dnp-nethermind.public.dappnode.eth";
const CHECKPOINT_ERROR =
  "2026-10-14T10:36:52.341901234Z 2026-10-14 10:36:52.341 FATAL - Exiting due to fatal error in BeaconChainController: Failed to load initial state from https://sync-mainnet.beaconcha.in/eth/v2/debug/beacon/states/finalized: Connect timed out";

const ticketPackages = [
  pkg(TEKU, "0.0.77", "Teku Consensus Client", { size: 1.0e9 }),
  pkg("bind.dnp.dappnode.eth", "10.0.17", "bind", { isCore: true, size: 15.3e3 }),
  pkg("dappmanager.dnp.dappnode.eth", "10.0.53", "Dappmanager", { isCore: true, size: 7.6e3 }),
  pkg("admin.dnp.dappnode.eth", "10.0.67", "Administration web UI", { isCore: true }),
  pkg("mevboost.avado.dnp.dappnode.eth", "0.0.19", "ETH Staking MEV-Boost"),
  pkg("remoteconnect.avado.dnp.dappnode.eth", "0.0.53", "Remote Access", { isCore: true, size: 16.2e3 }),
  pkg(NETHERMIND, "0.0.72", "Nethermind Execution Client", { size: 1.6e12 }),
  pkg("wifi.dnp.dappnode.eth", "10.0.1", "wifi", { isCore: true }),
  pkg("ipfs.dnp.dappnode.eth", "10.0.7", "ipfs", { isCore: true, size: 10.2e9 }),
  pkg("wamp.dnp.dappnode.eth", "0.2.2", "wamp", { isCore: true }),
];

const ticketDiagnostics = {
  collectedAt: "2026-10-14T11:45:31.880Z",
  durationMs: 8360,
  // Named by probe: host, dns, internet, ipfs, "ipfs peers", catalogue,
  // containers, and per package "processes|logs|settings|client|validators <id>"
  errors: ["validators teku.avado.dnp.dappnode.eth: connect ECONNREFUSED 127.0.0.1:5052"],
  host: {
    uptimeSeconds: 444217,
    bootedAt: "2026-10-09T08:22:14.000Z",
    loadavg: [1.21, 1.08, 0.94],
    cores: 8,
    memTotalMB: 31862,
    memAvailableMB: 17528,
    swapTotalMB: 976,
    swapUsedMB: 12,
    kernel: "6.1.0-26-amd64",
    os: "Debian GNU/Linux 12 (bookworm)",
    rootDisk: { totalGB: 3667, usedGB: 1577, availableGB: 1904 },
    temperatures: [{ name: "k10temp Tctl", celsius: 61.4 }],
    dmesg: {
      oom: [],
      hardware: [],
      network: [
        "[Tue Oct 14 07:58:40 2026] wlan0: disconnect from AP 5c:a6:e6:11:22:33 for new auth to 5c:a6:e6:11:22:33",
        "[Tue Oct 14 07:58:41 2026] wlan0: associated",
      ],
    },
  },
  network: {
    interfaces: [
      { name: "lo", type: "other", up: true, carrier: true, ipv4: ["127.0.0.1/8"] },
      { name: "enp2s0", type: "ethernet", up: false, carrier: false, ipv4: [] },
      { name: "wlan0", type: "wifi", up: true, carrier: true, ipv4: ["192.168.20.2/24"] },
      { name: "docker0", type: "other", up: false, carrier: false, ipv4: ["172.17.0.1/16"] },
      { name: "br-4c1f2a9e1d3b", type: "other", up: true, carrier: true, ipv4: ["172.33.0.1/16"] },
      { name: "veth8c2d1e4", type: "other", up: true, carrier: true, ipv4: [] },
    ],
    defaultRoute: { interface: "wlan0", gateway: "192.168.20.1" },
    dns: { resolves: { "bo.ava.do": { ok: true, ms: 38 }, "iso.ava.do": { ok: true, ms: 41 } } },
    internet: { "https://bo.ava.do/": { ok: true, status: 200, ms: 412 } },
    store: {
      ipfs: {
        running: true,
        restarting: false,
        restartCount: 0,
        restartsLastHour: 0,
        startedAt: "2026-10-12T13:07:02.000Z",
        peers: 3,
        storePeersConnected: 0,
        storePeersTotal: 2,
        lastLogLines: [],
      },
      // The catalogue error starts with the step that failed: "rpc.ava.do: …" or "IPFS: …"
      catalogue: { ok: false, ms: 8003, error: "IPFS: timed out after 8000 ms" },
    },
  },
  containers: [
    container(TEKU, {
      version: "0.0.77",
      status: "Up About an hour",
      startedAt: "2026-10-14T10:36:10.000Z",
      uptimeSeconds: 4161,
      processes: [
        { name: "teku", state: "FATAL", description: "Exited too quickly (process log may have details)" },
        { name: "monitor", state: "RUNNING", description: "pid 41, uptime 1:09:20" },
        { name: "nginx", state: "RUNNING", description: "pid 42, uptime 1:09:20" },
        { name: "reload-certs", state: "RUNNING", description: "pid 43, uptime 1:09:20" },
      ],
      log: {
        lines: [
          "2026-10-14T10:36:11.020Z 2026-10-14 10:36:11,020 INFO spawned: 'teku' with pid 40",
          "2026-10-14T10:36:11.024Z 2026-10-14 10:36:11,024 INFO spawned: 'monitor' with pid 41",
          "2026-10-14T10:36:12.101Z Execution engine: avado-dnp-nethermind.public.dappnode.eth (answering)",
          "2026-10-14T10:36:14.880Z 2026-10-14 10:36:14.880 INFO  - Teku version: teku/v26.9.1/linux-x86_64/-eclipseadoptium-openjdk64bitservervm-java-21",
          // Planted: the scrubber must hide it
          "2026-10-14T10:36:14.910Z keystore password: PlantedSecret123",
          "2026-10-14T10:36:15.402Z 2026-10-14 10:36:15.402 INFO  - Loading initial state from https://sync-mainnet.beaconcha.in/eth/v2/debug/beacon/states/finalized",
          CHECKPOINT_ERROR,
          "2026-10-14T10:36:52.402Z 2026-10-14 10:36:52,402 INFO exited: teku (exit status 2; not expected)",
          "2026-10-14T10:37:30.118Z 2026-10-14 10:37:30,118 INFO gave up: teku entered FATAL state, too many start retries too quickly",
          "2026-10-14T11:40:02.551Z [monitor] GET /rest/eth/v1/node/syncing -> connect ECONNREFUSED 127.0.0.1:5051",
        ],
        errors: [
          "2026-10-14T10:36:52.341Z 2026-10-14 10:36:52.341 ERROR - Failed to download initial state: Connect timed out",
          CHECKPOINT_ERROR,
          "2026-10-14T10:36:52.402Z 2026-10-14 10:36:52,402 INFO exited: teku (exit status 2; not expected)",
          "2026-10-14T10:37:30.118Z 2026-10-14 10:37:30,118 INFO gave up: teku entered FATAL state, too many start retries too quickly",
          "2026-10-14T11:40:02.551Z [monitor] GET /rest/eth/v1/node/syncing -> connect ECONNREFUSED 127.0.0.1:5051",
        ],
        errorCount: 47,
      },
      settings: {
        network: "mainnet",
        ee_endpoint: "http://avado-dnp-nethermind.my.ava.do:8551",
        execution_engine: NETHERMIND,
        validators_graffiti: "Avado",
        initial_state: "https://sync-mainnet.beaconcha.in",
        validators_proposer_default_fee_recipient: "0x4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70",
        mev_boost: true,
        // Planted: never printed (only known keys are)
        keystore_password: "PlantedSecret456",
      },
    }),
    container("bind.dnp.dappnode.eth", { isCore: true, version: "10.0.17", status: "Up 2 days", uptimeSeconds: 167920 }),
    container("dappmanager.dnp.dappnode.eth", {
      isCore: true,
      version: "10.0.53",
      log: {
        lines: [
          "2026-10-14T11:35:40.112Z info Store catalogue: could not fetch the store manifest: ipfs cat timed out after 8000 ms",
          "2026-10-14T11:45:31.880Z info Call getDiagnostics",
        ],
        errors: ["2026-10-14T11:35:40.112Z info Store catalogue: could not fetch the store manifest: ipfs cat timed out after 8000 ms"],
        errorCount: 12,
      },
    }),
    container("admin.dnp.dappnode.eth", { isCore: true, version: "10.0.67" }),
    container("mevboost.avado.dnp.dappnode.eth", {
      version: "0.0.19",
      log: {
        lines: ['2026-10-14T11:45:00.004Z time="2026-10-14T11:45:00Z" level=info msg="http: GET /eth/v1/builder/status 200"'],
        errors: [],
        errorCount: 0,
      },
    }),
    container("remoteconnect.avado.dnp.dappnode.eth", { isCore: true, version: "0.0.53" }),
    container(NETHERMIND, {
      version: "0.0.72",
      processes: [
        { name: "nethermind", state: "RUNNING", description: "pid 12, uptime 5 days, 3:22:41" },
        { name: "monitor", state: "RUNNING", description: "pid 13, uptime 5 days, 3:22:41" },
      ],
      log: {
        lines: [
          "2026-10-14T11:45:12.003Z 14 Oct 11:45:12 | Received new block:  23571234 (0x8f2e1a…)",
          "2026-10-14T11:45:12.410Z 14 Oct 11:45:12 | Processed           23571234     |     41.2 ms  |  slot      7,812 ms |",
          // Planted: a mnemonic (24 words) the scrubber must hide
          "2026-10-14T11:45:13.000Z abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual",
        ],
        errors: [],
        errorCount: 0,
      },
      // Not an AVADO client package with /data/settings.json
      settings: null,
    }),
    container("wifi.dnp.dappnode.eth", { isCore: true, version: "10.0.1" }),
    container("ipfs.dnp.dappnode.eth", {
      isCore: true,
      version: "10.0.7",
      status: "Up 47 hours",
      startedAt: "2026-10-12T13:07:02.000Z",
      uptimeSeconds: 167918,
      log: {
        lines: ["2026-10-12T13:07:12.000Z Daemon is ready"],
        errors: [],
        errorCount: 0,
      },
    }),
    container("wamp.dnp.dappnode.eth", { isCore: true, version: "0.2.2" }),
  ],
  clients: [
    {
      id: TEKU,
      role: "beacon",
      client: "teku",
      network: "mainnet",
      api: { reachable: false, error: "connect ECONNREFUSED 172.33.0.7:5051" },
      validators: null,
    },
    {
      id: NETHERMIND,
      role: "execution",
      client: "nethermind",
      network: "mainnet",
      api: {
        reachable: true,
        version: "Nethermind/v1.33.1+5c8d3a1b/linux-x64/dotnet9.0.9",
        syncing: { currentBlock: 23571234, highestBlock: 23571234, startingBlock: 0, synced: true },
        peers: 50,
      },
      validators: null,
    },
  ],
};

// The real report's recent activity (parsed userActionLogs, newest first)
const ticketLogs = [
  { timestamp: "2026-10-14T10:36:08.898Z", level: "info", event: "restartPackage.dappmanager.dnp.dappnode.eth", message: "Restarted package: teku.avado.dnp.dappnode.eth" },
  { timestamp: "2026-10-12T14:12:47.614Z", level: "info", event: "resetBeaconData.dappmanager.dnp.dappnode.eth", message: "Deleted 833 GB of beacon data from Teku. It is syncing again from its checkpoint." },
  { timestamp: "2026-10-12T13:06:57.296Z", level: "info", event: "restartPackageVolumes.dappmanager.dnp.dappnode.eth", message: "Restarted bind.dnp.dappnode.eth volumes" },
  { timestamp: "2026-08-27T23:25:41.409Z", level: "info", event: "setAutoUpdate.dappmanager.dnp.dappnode.eth", message: "Enabled auto-updates for admin.dnp.dappnode.eth" },
  { timestamp: "2026-03-06T12:02:32.864Z", level: "info", event: "restartPackage.dappmanager.dnp.dappnode.eth", message: "Restarted package: teku.avado.dnp.dappnode.eth" },
  { timestamp: "2025-10-10T22:00:59.576Z", level: "info", event: "installPackage.dappmanager.dnp.dappnode.eth", message: "Installed mevboost.avado.dnp.dappnode.eth@QmQpaYKKVZH1FURqcYCaG7Bz9Ti7hTuo6VSPDwrUXLfR5Q" },
];

export const ticket0928 = {
  now: NOW,
  packages: ticketPackages,
  diagnostics: ticketDiagnostics,
  userActionLogs: ticketLogs,
  params: { nodeid: "0xA4f8CE154452040E41A278ee7c9741A675c9Fd70", internalip: "192.168.20.2", ip: "85.84.83.82" },
  stats: { cpu: "8%", memory: "45%", disk: "43%", diskTotal: "3.67 TB" },
  chainData: [{ name: "Avado-dnp-nethermind", syncing: false, message: "" }],
  findings: [
    { id: "mevboost-relays", severity: "warning", topic: "setup", title: "MEV-Boost relays need a look", why: "Some relays you use are offline or retired.", fix: { kind: "link", label: "Review relays" } },
    {
      id: "store-unreachable",
      severity: "info",
      topic: "updates",
      title: "Can't check for updates",
      why: "Your AVADO could not reach the AVADO store. Check that it is connected to the internet; your apps keep running meanwhile.",
      fix: { kind: "steps", label: "What to check" },
      steps: ["Check that the network cable is plugged in and your router has internet."],
    },
  ],
  verdict: { level: "warning", label: "Needs attention" },
  versions: { admin: "10.0.67", dappmanager: "10.0.53", bind: "10.0.17", ipfs: "10.0.7" },
};

/* ---------------- healthy ---------------- */

const NIMBUS = "nimbus.avado.dnp.dappnode.eth";

const healthyPackages = [
  pkg(NIMBUS, "0.0.51", "Nimbus", { size: 180e9 }),
  pkg(NETHERMIND, "0.0.72", "Nethermind Execution Client", { size: 1.2e12 }),
  pkg("dappmanager.dnp.dappnode.eth", "10.0.53", "Dappmanager", { isCore: true }),
  pkg("ipfs.dnp.dappnode.eth", "10.0.7", "ipfs", { isCore: true }),
];

const healthyDiagnostics = {
  collectedAt: "2026-10-14T11:45:31.880Z",
  durationMs: 4120,
  errors: [],
  host: {
    uptimeSeconds: 1900000,
    bootedAt: "2026-09-22T11:59:00.000Z",
    loadavg: [0.8, 0.7, 0.7],
    cores: 8,
    memTotalMB: 31862,
    memAvailableMB: 20011,
    swapTotalMB: 976,
    swapUsedMB: 0,
    kernel: "6.1.0-26-amd64",
    os: "Debian GNU/Linux 12 (bookworm)",
    rootDisk: { totalGB: 3667, usedGB: 1400, availableGB: 2081 },
    temperatures: [{ name: "k10temp Tctl", celsius: 55 }, { name: "nvme Composite", celsius: 41.9 }],
    dmesg: { oom: [], hardware: [], network: [] },
  },
  network: {
    interfaces: [{ name: "enp2s0", type: "ethernet", up: true, carrier: true, ipv4: ["192.168.1.5/24"] }],
    defaultRoute: { interface: "enp2s0", gateway: "192.168.1.1" },
    dns: { resolves: { "bo.ava.do": { ok: true, ms: 20 }, "iso.ava.do": { ok: true, ms: 22 } } },
    internet: { "https://bo.ava.do/": { ok: true, status: 200, ms: 180 } },
    store: {
      ipfs: { running: true, restarting: false, restartCount: 0, restartsLastHour: 0, startedAt: "2026-09-22T12:00:00.000Z", peers: 41, storePeersConnected: 2, storePeersTotal: 2, lastLogLines: [] },
      catalogue: { ok: true, ms: 640 },
    },
  },
  containers: [
    container(NIMBUS, {
      version: "0.0.51",
      processes: [
        { name: "nimbus", state: "RUNNING", description: "pid 30, uptime 21 days, 23:46:12" },
        { name: "monitor", state: "RUNNING", description: "pid 31, uptime 21 days, 23:46:12" },
      ],
      log: {
        lines: ["2026-10-14T11:45:20.000Z INF 2026-10-14 11:45:20.000+00:00 Slot start topics=\"beacnde\" slot=12810412 peers=78 head=12810411"],
        errors: [],
        errorCount: 0,
      },
      settings: { network: "mainnet", ee_endpoint: "http://avado-dnp-nethermind.my.ava.do:8551", initial_state: "https://sync-mainnet.beaconcha.in", mev_boost: false },
    }),
    container(NETHERMIND, {
      version: "0.0.72",
      processes: [{ name: "nethermind", state: "RUNNING", description: "pid 12, uptime 21 days, 23:46:12" }],
      log: { lines: [], errors: [], errorCount: 0 },
      settings: null,
    }),
    container("dappmanager.dnp.dappnode.eth", { isCore: true, version: "10.0.53" }),
    container("ipfs.dnp.dappnode.eth", { isCore: true, version: "10.0.7" }),
  ],
  clients: [
    {
      id: NIMBUS,
      role: "beacon",
      client: "nimbus",
      network: "mainnet",
      api: {
        reachable: true,
        version: "Nimbus/v26.10.0-abc123-stateofus",
        syncing: { isSyncing: false, headSlot: 12810411, syncDistance: 1, isOptimistic: false, elOffline: false },
        peers: 78,
      },
      validators: { count: 4 },
    },
    {
      id: NETHERMIND,
      role: "execution",
      client: "nethermind",
      network: "mainnet",
      api: { reachable: true, version: "Nethermind/v1.33.1", syncing: { currentBlock: 23571234, highestBlock: 23571234, startingBlock: 0, synced: true }, peers: 50 },
      validators: null,
    },
  ],
};

export const healthy = {
  now: NOW,
  packages: healthyPackages,
  diagnostics: healthyDiagnostics,
  userActionLogs: [],
  params: { nodeid: "0xNODE", internalip: "192.168.1.5" },
  stats: { cpu: "5%", memory: "37%", disk: "38%", diskTotal: "3.67 TB" },
  chainData: [],
  findings: [],
  verdict: { level: "ok", label: "All good" },
  versions: { admin: "10.0.67", dappmanager: "10.0.53" },
};
