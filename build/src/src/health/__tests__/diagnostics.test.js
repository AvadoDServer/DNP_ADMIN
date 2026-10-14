import { deriveProblems, scrub, lastError, clip, formatDuration, storeCause, processesDown } from "health/diagnostics";
import { ticket0928, healthy, tekuOptionCrash } from "./fixtures-diagnostics";

const clone = v => JSON.parse(JSON.stringify(v));
const NOW = ticket0928.now;
const problems = (d, logs = [], packages = ticket0928.packages) => deriveProblems(d, packages, logs, NOW);
const texts = list => list.map(p => p.text);

describe("deriveProblems on ticket-0928", () => {
  const found = problems(ticket0928.diagnostics, ticket0928.userActionLogs);

  it("finds Teku's program down with its last error and the checkpoint URL in use, first", () => {
    expect(found[0].severity).toBe("critical");
    expect(found[0].appId).toBe("teku.avado.dnp.dappnode.eth");
    expect(found[0].text).toMatch(/^Teku Consensus Client: the teku process is not running \(FATAL: Exited too quickly/);
    expect(found[0].text).toContain('Last error: "FATAL - Exiting due to fatal error in BeaconChainController');
    expect(found[0].text).toContain("Connect timed out");
    expect(found[0].text).toContain("Checkpoint URL in use: https://sync-mainnet.beaconcha.in");
  });

  it("explains 'Can't check for updates': IPFS reaches none of the AVADO store nodes", () => {
    expect(texts(found)).toContain(
      "Can't check for updates because IPFS could not fetch the catalogue (timed out after 8000 ms); IPFS is not connected to the AVADO store nodes (peers: 3)"
    );
  });

  it("says the box is on Wi-Fi with no Ethernet link, as a warning", () => {
    const wifi = found.find(p => p.text.startsWith("The box uses Wi-Fi"));
    expect(wifi).toEqual({ severity: "warning", text: "The box uses Wi-Fi (wlan0) for its internet connection; the Ethernet port has no link", appId: undefined });
  });

  it("nothing else: no API line for Teku (its program is down), two Wi-Fi blips are not flapping", () => {
    expect(found).toHaveLength(3);
    expect(texts(found).join("\n")).not.toContain("API does not answer");
  });

  it("is most severe first", () => {
    const order = ["critical", "warning", "info"];
    const ranks = found.map(p => order.indexOf(p.severity));
    expect([...ranks].sort()).toEqual(ranks);
  });
});

describe("deriveProblems on a healthy box", () => {
  it("finds nothing", () => {
    expect(problems(healthy.diagnostics, [], healthy.packages)).toEqual([]);
  });
  it("finds nothing without diagnostics", () => {
    expect(problems(null)).toEqual([]);
  });
});

describe("deriveProblems, one rule at a time", () => {
  const box = () => clone(healthy.diagnostics);
  const pkgs = healthy.packages;
  const nimbus = d => d.containers.find(c => c.id === "nimbus.avado.dnp.dappnode.eth");

  it("an exited, OOM-killed app; a restart loop", () => {
    const d = box();
    Object.assign(nimbus(d), { state: "exited", exitCode: 137, status: "Exited (137) 5 minutes ago", oomKilled: true, processes: [] });
    Object.assign(d.containers[1], { restartCount: 5, uptimeSeconds: 120 });
    const t = texts(problems(d, [], pkgs));
    expect(t).toContain("Nimbus is exited (exit code 137, Exited (137) 5 minutes ago)");
    expect(t).toContain("Nimbus was killed because the box ran out of memory");
    expect(t).toContain("Nethermind Execution Client restarted 5 times recently");
  });

  it("a program stopped from the app's page is only info; FATAL, BACKOFF and EXITED are not running", () => {
    const d = box();
    nimbus(d).processes[0] = { name: "nimbus", state: "STOPPED", description: "Oct 14 10:00 AM" };
    expect(problems(d, [], pkgs)).toEqual([
      { severity: "info", text: "Nimbus: the nimbus process is stopped (stopped from the app)", appId: "nimbus.avado.dnp.dappnode.eth" },
    ]);
    for (const state of ["FATAL", "BACKOFF", "EXITED"]) {
      nimbus(d).processes[0] = { name: "nimbus", state, description: "Exited too quickly" };
      expect(problems(d, [], pkgs)[0]).toMatchObject({ severity: "critical", text: expect.stringContaining(`the nimbus process is not running (${state}: Exited too quickly)`) });
    }
  });

  it("the light variant (no programs, no log) finds nothing and does not crash", () => {
    const d = box();
    for (const c of d.containers) Object.assign(c, { processes: [], log: null, settings: null });
    Object.assign(d, { host: null, network: null, clients: null });
    expect(problems(d, [], pkgs)).toEqual([]);
  });

  it("the store chain: DNS, then internet, then IPFS, then the step the catalogue error names, then store nodes", () => {
    const d = box();
    d.network.store.catalogue = { ok: false, ms: 8000, error: "boom" };
    expect(storeCause(d.network)).toBe("boom");
    d.network.store.catalogue.error = "rpc.ava.do: request timed out after 5000 ms";
    expect(storeCause(d.network)).toBe("the AVADO update server did not answer (request timed out after 5000 ms)");
    d.network.store.catalogue.error = "IPFS: no providers found";
    expect(storeCause(d.network)).toBe("IPFS could not fetch the catalogue (no providers found)");
    d.network.store.ipfs.storePeersConnected = 0;
    expect(storeCause(d.network)).toBe("IPFS could not fetch the catalogue (no providers found); IPFS is not connected to the AVADO store nodes (peers: 41)");
    d.network.store.catalogue.error = "rpc.ava.do: 502 Bad Gateway";
    expect(storeCause(d.network)).toBe("the AVADO update server did not answer (502 Bad Gateway)");
    // No step named: the error as it came
    d.network.store.catalogue.error = "boom";
    expect(storeCause(d.network)).toBe("boom");
    Object.assign(d.network.store.ipfs, { restarting: true, restartCount: 9, lastLogLines: ["Error: repo corrupted"] });
    expect(storeCause(d.network)).toBe("IPFS is restarting (9 restarts, last line: Error: repo corrupted)");
    d.network.internet["https://bo.ava.do/"] = { ok: true, status: 404, ms: 90 };
    expect(storeCause(d.network)).toMatch(/^IPFS is restarting/);
    d.network.internet["https://bo.ava.do/"] = { ok: false, error: "ETIMEDOUT" };
    expect(storeCause(d.network)).toBe("the box has no internet connection (ETIMEDOUT)");
    d.network.dns.resolves["bo.ava.do"] = { ok: false, error: "EAI_AGAIN" };
    expect(texts(problems(d, [], pkgs))).toContain("Can't check for updates because the box cannot resolve internet names (DNS)");
  });

  it("Wi-Fi with a working Ethernet port is only info", () => {
    const d = box();
    d.network.interfaces.push({ name: "wlp3s0", type: "wifi", up: true, carrier: true, ipv4: ["192.168.1.9/24"] });
    d.network.defaultRoute = { interface: "wlp3s0", gateway: "192.168.1.1" };
    expect(problems(d, [], pkgs)).toEqual([{ severity: "info", text: "The box uses Wi-Fi (wlp3s0) for its internet connection", appId: undefined }]);
  });

  it("a restart without a reboot from the dashboard: a warning under 6 h, info under 24 h", () => {
    const booted = hours => {
      const d = box();
      d.host.uptimeSeconds = hours * 3600;
      d.host.bootedAt = new Date(NOW.getTime() - hours * 3600 * 1000).toISOString();
      return d;
    };
    expect(problems(booted(3), [], pkgs)).toEqual([
      {
        severity: "warning",
        text: "The box restarted 3 h ago without a reboot from the AVADO dashboard (power loss, crash or a reboot from the terminal)",
        appId: undefined,
      },
    ]);
    expect(problems(booted(10), [], pkgs)[0].severity).toBe("info");
    expect(problems(booted(25), [], pkgs)).toEqual([]);
    // rebootHost (DAPPMANAGER 10.0.53 logs it) up to 15 min before the boot explains it
    const at = minutes => [{ timestamp: new Date(NOW.getTime() - 3 * 3600 * 1000 - minutes * 60 * 1000).toISOString(), event: "rebootHost", level: "info" }];
    expect(problems(booted(3), at(1), pkgs)).toEqual([]);
    expect(problems(booted(3), [{ ...at(1)[0], event: "rebootHost.dappmanager.dnp.dappnode.eth" }], pkgs)).toEqual([]);
    expect(problems(booted(3), at(20), pkgs)).toHaveLength(1);
  });

  it("kernel log, temperatures and memory", () => {
    const d = box();
    d.host.dmesg = {
      oom: ["Out of memory: Killed process 123 (java)", "oom-kill: constraint=CONSTRAINT_NONE"],
      hardware: ["nvme nvme0: I/O 12 QID 3 timeout, reset controller"],
      network: ["enp2s0: Link is Down", "enp2s0: Link is Up", "enp2s0: Link is Down"],
    };
    d.host.temperatures.push({ name: "nvme Composite", celsius: 84.9 });
    Object.assign(d.host, { memAvailableMB: 900, swapUsedMB: 950 });
    const t = texts(problems(d, [], pkgs));
    expect(t).toContain("The system killed processes for lack of memory (2 times in the kernel log)");
    expect(t).toContain('Kernel reports hardware errors: "nvme nvme0: I/O 12 QID 3 timeout, reset controller"');
    expect(t).toContain("The network link went down and up 3 times");
    expect(t).toContain("nvme Composite is at 84.9 °C");
    expect(t).toContain("The box is out of memory (900 MB of 31862 MB free, swap 950 of 976 MB used)");
  });

  it("the clients' own view", () => {
    const d = box();
    const [beacon, exec] = d.clients;
    beacon.api.syncing = { isSyncing: true, headSlot: 100, syncDistance: 5000, isOptimistic: false, elOffline: true };
    beacon.api.peers = 4;
    exec.api.syncing = { currentBlock: 100, highestBlock: 200, startingBlock: 0, synced: false };
    d.clients.push({ id: "eth2validator.avado.dnp.dappnode.eth", role: "validator", client: "prysm", network: "mainnet", api: { reachable: true }, validators: { count: 0 } });
    const t = texts(problems(d, [], pkgs));
    expect(t).toContain("Nimbus is syncing (5000 slots behind)");
    expect(t).toContain("Nimbus is not connected to the execution client");
    expect(t).toContain("Nimbus has only 4 peers");
    expect(t).toContain("Nethermind Execution Client is syncing (block 100 of 200)");
    expect(t).toContain("eth2validator has no validator keys");
  });

  it("no validator keys is said only for a validator client, not for a beacon node without keys", () => {
    const d = box();
    d.clients[0].validators = { count: 0 };
    expect(problems(d, [], pkgs)).toEqual([]);
  });

  it("Prysm's validator has only `reachable`: nothing when it answers, its key manager when it does not", () => {
    const d = box();
    const vc = { id: "eth2validator.avado.dnp.dappnode.eth", role: "validator", client: "prysm", network: "mainnet", api: { reachable: true }, validators: { count: 3 } };
    d.clients.push(vc);
    expect(problems(d, [], pkgs)).toEqual([]);
    vc.api = { reachable: false, error: "timeout" };
    expect(texts(problems(d, [], pkgs))).toEqual(["eth2validator's key manager does not answer (timeout)"]);
  });

  it("a program being stopped (UNKNOWN \"STOPPING …\") is only info, and its API is not blamed", () => {
    const d = box();
    nimbus(d).processes[0] = { name: "nimbus", state: "UNKNOWN", description: "STOPPING Oct 14 11:45 AM" };
    d.clients[0].api = { reachable: false, error: "connect ECONNREFUSED" };
    expect(problems(d, [], pkgs)).toEqual([
      { severity: "info", text: "Nimbus: the nimbus process is stopping (stopped from the app)", appId: "nimbus.avado.dnp.dappnode.eth" },
    ]);
    nimbus(d).processes[0] = { name: "nimbus", state: "UNKNOWN", description: "unknown state" };
    expect(texts(problems(d, [], pkgs))).not.toContain(expect.stringContaining("process is not running"));
  });

  it("an API that does not answer while its program runs", () => {
    const d = box();
    d.clients[0].api = { reachable: false, error: "connect ECONNREFUSED 172.33.0.9:5052" };
    expect(texts(problems(d, [], pkgs))).toEqual(["Nimbus's API does not answer (connect ECONNREFUSED 172.33.0.9:5052)"]);
  });
});

describe("helpers", () => {
  it("scrub: long hex, key=value secrets, bearer tokens, URL passwords, mnemonics; keeps addresses", () => {
    expect(scrub("root " + "ab".repeat(40))).toBe("root ababab…");
    expect(scrub("PASSWORD=hunter2 and api_key: xyz")).toBe("PASSWORD=<redacted> and api_key=<redacted>");
    expect(scrub("Authorization: Bearer eyJ.abc")).toBe("Authorization: Bearer <redacted>");
    expect(scrub("https://user:pa55@node.example/x")).toBe("https://<redacted>@node.example/x");
    expect(scrub("a b c d e f g h i j k l")).toBe("<12+ words redacted>");
    expect(scrub("fee recipient 0x4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70")).toBe("fee recipient 0x4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70");
  });

  it("lastError: skips supervisord's bookkeeping and prefers a line with an error level", () => {
    const c = ticket0928.diagnostics.containers[0];
    expect(lastError(c)).toMatch(/^FATAL - Exiting due to fatal error/);
    expect(lastError(c).length).toBeLessThanOrEqual(160);
    expect(lastError({ log: { errors: ["x INFO gave up: teku entered FATAL state"] } })).toBe("x INFO gave up: teku entered FATAL state");
    expect(lastError({ log: null })).toBeNull();
  });

  it("lastError on the test box: the client's own complaint before supervisord's crash marker, not the monitor's polling", () => {
    expect(lastError(tekuOptionCrash, "teku")).toBe("Invalid value for option '--p2p-peer-lower-bound': cannot convert 'null' to OptionalInt");
    expect(lastError(tekuOptionCrash)).toBe("Invalid value for option '--p2p-peer-lower-bound': cannot convert 'null' to OptionalInt");
    // The ticket's still is the checkpoint failure
    expect(lastError(ticket0928.diagnostics.containers[0], "teku")).toMatch(/^FATAL - Exiting .*Connect timed out$/);
  });

  it("lastError when the marker has left the last lines: never the monitor's noise or jq", () => {
    const noisy = {
      log: {
        lines: Array.from({ length: 40 }, (_, i) => `2026-10-14T14:${String(i).padStart(2, "0")}:00.000Z request failed: get https://teku.my.ava.do:5052/eth/v1/keystores`),
        errors: [
          "2026-10-14T13:02:13.611Z 2026-10-14 13:02:13,611 INFO gave up: teku entered FATAL state, too many start retries too quickly",
          "2026-10-14T14:38:00.000Z request failed: get https://teku.my.ava.do:5052/eth/v1/keystores",
          "2026-10-14T14:38:00.002Z jq: error (at <stdin>:0): Cannot iterate over null (null)",
          "2026-10-14T14:39:00.000Z fetching validators returned 502",
        ],
      },
    };
    expect(lastError(noisy, "teku")).toBe("INFO gave up: teku entered FATAL state, too many start retries too quickly");
    // Another program's marker is not this one's
    const other = { log: { lines: ["boom error in teku", "INFO exited: monitor (exit status 1; not expected)"], errors: ["boom error in teku"] } };
    expect(lastError(other, "teku")).toBe("boom error in teku");
  });

  it("the problem line quotes the test box's real cause", () => {
    const d = JSON.parse(JSON.stringify(ticket0928.diagnostics));
    d.containers[0] = JSON.parse(JSON.stringify(tekuOptionCrash));
    const [first] = deriveProblems(d, ticket0928.packages, [], NOW);
    expect(first.text).toContain(`Last error: "Invalid value for option '--p2p-peer-lower-bound': cannot convert 'null' to OptionalInt"`);
    expect(first.text).not.toContain("request failed");
  });

  it("clip keeps both ends", () => {
    const s = `start ${"x".repeat(300)} end`;
    expect(clip(s, 40)).toHaveLength(40);
    expect(clip(s, 40).startsWith("start")).toBe(true);
    expect(clip(s, 40).endsWith(" end")).toBe(true);
  });

  it("formatDuration", () => {
    expect(formatDuration(444217)).toBe("5 days 3 h");
    expect(formatDuration(4161)).toBe("1 h 9 min");
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(50)).toBe("50 s");
    expect(formatDuration(null)).toBe("?");
  });

  it("processesDown: nothing for a stopped container (that is the container's own finding)", () => {
    const c = { ...ticket0928.diagnostics.containers[0], state: "exited" };
    expect(processesDown(c)).toEqual([]);
  });
});
