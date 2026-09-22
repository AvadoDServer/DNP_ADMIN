import { buildReport, mailtoReport } from "health/report";

const input = {
  verdict: { level: "critical", label: "Action required" },
  findings: [{ id: "consensus-without-execution:mainnet", severity: "critical", topic: "setup", title: "Nimbus has no execution client" }],
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48", state: "running", isCore: false,
    envs: { GF_SECURITY_ADMIN_PASSWORD: "hunter2", FEE_RECIPIENT: "0xabc" },
    volumes: [{ size: 2e11 }], manifest: { title: "Nimbus" } }],
  stats: { cpu: "4%", memory: "10%", disk: "12%", diskTotal: "3.6 TB" },
  params: { internalIp: "192.168.1.20", ip: "85.84.83.82", nodeid: "0xNODE", name: "My AVADO" },
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
    expect(r).toContain("192.168.1.20");
    expect(r).toContain("0xNODE");
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
});
