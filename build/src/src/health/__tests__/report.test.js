import { buildReport, mailtoReport, REPORT_MAX_CHARS } from "health/report";
import { ticket0928, healthy, PLANTED_SECRETS } from "./fixtures-diagnostics";

const input = {
  verdict: { level: "critical", label: "Action required" },
  findings: [{ id: "consensus-without-execution:mainnet", severity: "critical", topic: "setup", title: "Nimbus has no execution client" }],
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48", state: "running", isCore: false,
    envs: { GF_SECURITY_ADMIN_PASSWORD: "hunter2", FEE_RECIPIENT: "0xabc" },
    volumes: [{ size: 2e11 }], manifest: { title: "Nimbus" } }],
  stats: { cpu: "4%", memory: "10%", disk: "12%", diskTotal: "3.6 TB" },
  // As the core sends them (DAPPMANAGER getParams): `internalip`, lower-case.
  params: { internalip: "192.168.1.20", ip: "85.84.83.82", nodeid: "0xNODE", name: "My AVADO" },
  chainData: [{ name: "Nimbus", syncing: false, message: "Synced" }],
  userActionLogs: [{ event: "restartPackage.dappmanager.dnp.dappnode.eth", level: "info", message: "Restarted", timestamp: "2026-09-22T10:00:00Z", kwargs: { id: "x", privateKey: "0xSECRET" } }],
  versions: { admin: "10.0.52", dappmanager: "10.0.47" },
  now: new Date("2026-09-22T12:00:00Z"),
};

describe("buildReport", () => {
  const r = buildReport(input);
  it("contains the verdict, findings, versions and apps", () => {
    expect(r).toContain("Action required");
    expect(r).toContain("[critical] Nimbus has no execution client");
    expect(r).toContain("admin 10.0.52");
    expect(r).toContain("Nimbus (nimbus.avado.dnp.dappnode.eth) 0.0.48 running");
    expect(r).toContain("- internal IP 192.168.1.20");
    expect(r).toContain("0xNODE");
  });
  it("also reads the old internalIp spelling", () => {
    expect(buildReport({ ...input, params: { internalIp: "192.168.1.30" } })).toContain("- internal IP 192.168.1.30");
    expect(buildReport({ ...input, params: {} })).toContain("- internal IP ?");
  });
  it("never leaks env values, public IPs or log arguments", () => {
    expect(r).not.toContain("hunter2");
    expect(r).not.toContain("0xabc");
    expect(r).not.toContain("85.84.83.82");
    expect(r).not.toContain("0xSECRET");
  });
  it("keeps the mailto link short", () => {
    const url = mailtoReport(r, input.verdict, input.findings);
    expect(url.startsWith("mailto:ziga@ava.do?subject=")).toBe(true);
    expect(url.length).toBeLessThanOrEqual(1800);
  });
  it("asks the user to attach the downloaded report, since a mailto link can't attach files", () => {
    const url = mailtoReport(r, input.verdict, input.findings);
    const body = decodeURIComponent(url.split("&body=")[1]);
    expect(body).toContain("Please attach the diagnostics report you downloaded (Help → Download report).");
    expect(body).not.toContain("is attached");
  });

  it("when trimming for length, drops findings lines first — the attach line always survives", () => {
    const manyLongFindings = Array.from({ length: 8 }, (_, i) => ({
      id: `f${i}`,
      severity: "warning",
      title: `Finding number ${i}: `.padEnd(220, "x"),
    }));
    const url = mailtoReport(r, input.verdict, manyLongFindings);
    expect(url.length).toBeLessThanOrEqual(1800);
    const body = decodeURIComponent(url.split("&body=")[1]);
    expect(body).toContain("Please attach the diagnostics report you downloaded (Help → Download report).");
    // At least one finding line had to be dropped to fit under the budget.
    const shownCount = manyLongFindings.filter(f => body.includes(f.title)).length;
    expect(shownCount).toBeLessThan(manyLongFindings.length);
  });

  it("reports 'still checking' instead of the verdict label when ready is false", () => {
    const stillChecking = buildReport({ ...input, findings: [], ready: false });
    expect(stillChecking).toContain("Health: still checking");
    expect(stillChecking).not.toContain("Action required");
  });

  it("mailtoReport also says 'still checking' (subject and body) when ready is false", () => {
    const url = mailtoReport(r, input.verdict, [], false);
    expect(url).toContain(encodeURIComponent("AVADO support: still checking"));
    const body = decodeURIComponent(url.split("&body=")[1]);
    expect(body).toContain("Health: still checking");
    expect(body).not.toContain("Action required");
  });

  it("still reports the real verdict when ready is true (or omitted, the default)", () => {
    expect(buildReport(input)).toContain("Health: Action required");
    const url = mailtoReport(r, input.verdict, input.findings, true);
    const body = decodeURIComponent(url.split("&body=")[1]);
    expect(body).toContain("Health: Action required");
  });
});

describe("buildReport with diagnostics (DAPPMANAGER 10.0.53)", () => {
  const ticket = buildReport({ ...ticket0928, ready: true });
  const sectionOrder = ["Health:", "What we found", "Versions", "Box", "Network", "Apps", "Processes", "Clients", "Chains", "Logs", "Recent activity"];
  const lines = ticket.split("\n");

  it("has every section, in order", () => {
    const at = sectionOrder.map(h => lines.findIndex(l => l === h || (h.endsWith(":") && l.startsWith(h))));
    expect(at.every(i => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("follows each finding with why and its first step", () => {
    expect(ticket).toContain("- [info] Can't check for updates\n    Why: Your AVADO could not reach the AVADO store.");
    expect(ticket).toContain("    Fix: Check that the network cable is plugged in and your router has internet.");
    expect(ticket).toContain("- [warning] MEV-Boost relays need a look\n    Why: Some relays you use are offline or retired.\n    Fix: Review relays");
  });

  it("finds the fault of ticket-0928: Teku's program down, the checkpoint URL, why updates fail", () => {
    const found = ticket.slice(ticket.indexOf("What we found"), ticket.indexOf("\nVersions"));
    expect(found).toContain("- [critical] Teku Consensus Client: the teku process is not running (FATAL: Exited too quickly");
    expect(found).toContain("Checkpoint URL in use: https://sync-mainnet.beaconcha.in");
    expect(found).toContain(
      "- [warning] Can't check for updates because IPFS could not fetch the catalogue (timed out after 8000 ms); IPFS is not connected to the AVADO store nodes (peers: 3)"
    );
    expect(found).toContain("- [warning] The box uses Wi-Fi (wlan0) for its internet connection; the Ethernet port has no link");
  });

  it("prints the box, network, apps, programs and clients", () => {
    expect(ticket).toContain("- up 5 days 3 h, booted at 2026-10-09T08:22:14.000Z");
    expect(ticket).toContain("- load 1.21 1.08 0.94 on 8 cores");
    expect(ticket).toContain("- memory 14.0 GB used of 31.1 GB, swap 12 MB used of 976 MB");
    expect(ticket).toContain("- system disk 1577 GB used of 3667 GB (1904 GB free)");
    expect(ticket).toContain("- temperatures: k10temp Tctl 61.4 °C");
    expect(ticket).toContain("- could not read: validators teku.avado.dnp.dappnode.eth: connect ECONNREFUSED 127.0.0.1:5052");
    expect(ticket).toContain("- wlan0 wifi up link 192.168.20.2/24");
    expect(ticket).toContain("- enp2s0 ethernet down no link");
    expect(ticket).not.toContain("veth8c2d1e4");
    expect(ticket).toContain("- default route via wlan0 (gateway 192.168.20.1)");
    expect(ticket).toContain("- IPFS running, restarts 0 (0 in the last hour), peers 3, AVADO store nodes 0 of 2");
    expect(ticket).toContain("- store catalogue: failed after 8003 ms (IPFS: timed out after 8000 ms)");
    expect(ticket).toContain("- Teku Consensus Client (teku.avado.dnp.dappnode.eth) 0.0.77 running, Up About an hour, restarts 0, exit 0, disk 1.0 GB");
    expect(ticket).toContain("    teku FATAL Exited too quickly (process log may have details)");
    expect(ticket).toContain("- Teku Consensus Client: beacon (teku, mainnet), API not answering (connect ECONNREFUSED 172.33.0.7:5051)");
    expect(ticket).toContain("    checkpoint URL (initial_state): https://sync-mainnet.beaconcha.in");
    expect(ticket).toContain("    execution endpoint (ee_endpoint): http://avado-dnp-nethermind.my.ava.do:8551");
    expect(ticket).toContain("    MEV-Boost (mev_boost): true");
    expect(ticket).toContain("synced, block 23571234 of 23571234, 50 peers");
  });

  it("prints the logs of every app plus IPFS and the DAPPMANAGER, not of other system apps", () => {
    const logs = ticket.slice(ticket.indexOf("\nLogs\n"), ticket.indexOf("\nRecent activity"));
    expect(logs).toContain("- Teku Consensus Client (teku.avado.dnp.dappnode.eth): 47 error lines in the last 500");
    expect(logs).toContain("- Dappmanager (dappmanager.dnp.dappnode.eth): 12 error lines");
    expect(logs).toContain("- ipfs (ipfs.dnp.dappnode.eth)");
    expect(logs).not.toContain("bind.dnp.dappnode.eth");
  });

  it("never shows a planted secret, env values or the public IP", () => {
    for (const s of PLANTED_SECRETS) expect(ticket).not.toContain(s);
    expect(ticket).toContain("keystore password=<redacted>");
    expect(ticket).toContain("<12+ words redacted>");
    expect(ticket).not.toContain("85.84.83.82");
    expect(ticket).not.toContain("keystore_password");
  });

  it("a healthy box: nothing beyond the health findings", () => {
    const r = buildReport({ ...healthy, ready: true });
    expect(r).toContain("What we found\n- nothing beyond the health findings\n");
    expect(r).toContain("    validator keys: 4");
  });

  it("stays under 200 000 characters, trimming the oldest log lines first", () => {
    const d = JSON.parse(JSON.stringify(ticket0928.diagnostics));
    const big = Array.from({ length: 40 }, (_, i) => `line ${i} ${"x".repeat(1900)}`);
    d.containers = Array.from({ length: 12 }, (_, i) => ({ ...d.containers[0], id: `app${i}.avado.dnp.dappnode.eth`, log: { lines: big, errors: big.slice(0, 5), errorCount: 500 } }));
    const r = buildReport({ ...ticket0928, diagnostics: d });
    expect(r.length).toBeLessThanOrEqual(REPORT_MAX_CHARS);
    expect(r).toContain("older left out");
    expect(r).toContain("\nRecent activity\n");
    // The newest line of an app survives, its oldest shown one is gone
    expect(r).toContain("line 39 ");
    expect(r).not.toMatch(/ {6}line 20 /);
  });
});

describe("buildReport without diagnostics", () => {
  it("an older DAPPMANAGER: one line under Box", () => {
    const r = buildReport({ ...ticket0928, packages: ticket0928.packages.map(p => (p.name === "dappmanager.dnp.dappnode.eth" ? { ...p, version: "10.0.52" } : p)), diagnostics: null });
    expect(r).toContain("- Box details need DAPPMANAGER 10.0.53 or newer");
    expect(r).toContain("What we found\n- box details not collected (see Box)");
    expect(r).not.toContain("\nNetwork\n");
    expect(r).toContain("- Teku Consensus Client (teku.avado.dnp.dappnode.eth) 0.0.77 running, disk 1.0 GB");
  });

  it("the call failed: the report is still built and says why", () => {
    const r = buildReport({ ...ticket0928, diagnostics: null, diagnosticsError: "timed out after 30 s" });
    expect(r).toContain("- Box details: could not be collected: timed out after 30 s");
    expect(r).toContain("\nRecent activity\n");
  });

  it("while it is collected", () => {
    expect(buildReport({ ...ticket0928, diagnostics: null, diagnosticsLoading: true })).toContain("- Box details: still collecting");
  });
});

describe("buildReport snapshots", () => {
  it("ticket-0928 with diagnostics", () => {
    expect(buildReport({ ...ticket0928, ready: true })).toMatchSnapshot();
  });
  it("ticket-0928 without diagnostics (older DAPPMANAGER)", () => {
    const packages = ticket0928.packages.map(p => (p.name === "dappmanager.dnp.dappnode.eth" ? { ...p, version: "10.0.52" } : p));
    expect(buildReport({ ...ticket0928, packages, diagnostics: null, ready: true })).toMatchSnapshot();
  });
});

describe("buildReport, client lines", () => {
  const withClients = (clients, containers = []) => {
    const d = JSON.parse(JSON.stringify(healthy.diagnostics));
    d.clients.push(...clients);
    d.containers.push(...containers);
    return buildReport({ ...healthy, diagnostics: d });
  };
  const PRYSM_VC = "eth2validator.avado.dnp.dappnode.eth";

  it("Prysm's validator: its key manager answering or not, its keys and its settings", () => {
    const r = withClients(
      [{ id: PRYSM_VC, role: "validator", client: "prysm", network: "mainnet", api: { reachable: true }, validators: { count: 2 } }],
      [{ id: PRYSM_VC, state: "running", processes: [], log: null, settings: { mev_boost: true, fee_recipient: "0x4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70" } }]
    );
    expect(r).toContain("- eth2validator: validator (prysm, mainnet), key manager answering\n    validator keys: 2");
    expect(r).toContain("    fee recipient (fee_recipient): 0x4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70");
    const down = withClients([{ id: PRYSM_VC, role: "validator", client: "prysm", network: "mainnet", api: { reachable: false, error: "timeout" }, validators: null }]);
    expect(down).toContain("- eth2validator: validator (prysm, mainnet), key manager not answering (timeout)");
    expect(down).toContain("- [critical] eth2validator's key manager does not answer (timeout)");
  });

  it("a client without settings, and an app without a client entry, still print", () => {
    const r = withClients([], [{ id: "ethchain-geth.public.dappnode.eth", version: "0.1.0", state: "running", status: "Up 2 hours", restartCount: 0, exitCode: 0, processes: [{ name: "geth", state: "RUNNING", description: "pid 7, uptime 2:00:01" }], log: { lines: ["INFO Imported new chain segment"], errors: [], errorCount: 0 }, settings: null }]);
    expect(r).toContain("- Nethermind Execution Client: execution (nethermind, mainnet), Nethermind/v1.33.1, synced");
    expect(r).toContain("- ethchain-geth (ethchain-geth.public.dappnode.eth) 0.1.0 running, Up 2 hours, restarts 0, exit 0");
    expect(r).toContain("    geth RUNNING pid 7, uptime 2:00:01");
    expect(r).toContain("- ethchain-geth (ethchain-geth.public.dappnode.eth): 0 error lines in the last 500");
  });

  it("an HTTP answer of any status is internet", () => {
    const d = JSON.parse(JSON.stringify(healthy.diagnostics));
    d.network.internet["https://bo.ava.do/"] = { ok: true, status: 404, ms: 90 };
    const r = buildReport({ ...healthy, diagnostics: d });
    expect(r).toContain("- internet https://bo.ava.do/: ok (404, 90 ms)");
    expect(r).toContain("What we found\n- nothing beyond the health findings");
  });
});

