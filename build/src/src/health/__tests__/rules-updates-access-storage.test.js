import { updatesAvailable, coreUpdateAvailable, autoupdateOff, storeUnreachable } from "health/rules/updates";
import { portsClosed, noUpnp, noNatLoopback, remoteAccessMissing } from "health/rules/access";
import { diskHigh, parsePercent, parseDockerSize, appDiskUse } from "health/rules/storage";
import { diagnoseFailed } from "health/rules/core";
import { pkg, snapshot } from "./fixtures";

describe("updates", () => {
  it("summarises available updates in one finding", () => {
    const f = updatesAvailable(snapshot({ updates: { a: { from: "1", to: "2" }, b: { from: "1", to: "3" } } }));
    expect(f).toMatchObject({ id: "updates-available", severity: "warning", title: "2 app updates are available", fix: { to: "/system/updates" } });
    expect(updatesAvailable(snapshot({ updates: { a: { from: "1", to: "2" } } })).title).toBe("1 app update is available");
    expect(updatesAvailable(snapshot({ updates: {} }))).toBeNull();
    expect(updatesAvailable(snapshot({ updates: null }))).toBeNull();
  });
  it("flags a core update", () => {
    expect(coreUpdateAvailable(snapshot({ coreUpdate: { available: true } }))).toMatchObject({ severity: "warning", fix: { to: "/system/updates" } });
    expect(coreUpdateAvailable(snapshot())).toBeNull();
  });
  it("notes clients with auto-update off", () => {
    const s = snapshot({ packages: [pkg("nimbus.avado.dnp.dappnode.eth", { autoupdate: false }), pkg("rotki.avado.dnp.dappnode.eth", { autoupdate: false })] });
    const out = autoupdateOff(s);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ severity: "info", appId: "nimbus.avado.dnp.dappnode.eth", dismissable: true });
  });
  it("updates-store-unreachable: explains a failed store fetch", () => {
    expect(storeUnreachable(snapshot({ sources: { updates: "failed" } }))).toMatchObject({ id: "store-unreachable", severity: "info" });
    expect(storeUnreachable(snapshot({ sources: { updates: "ok" } }))).toBeNull();
  });
});

describe("access", () => {
  it("maps params flags to findings", () => {
    expect(portsClosed(snapshot({ params: { alertToOpenPorts: true } }))).toMatchObject({ severity: "warning", topic: "access" });
    expect(portsClosed(snapshot({ params: {} }))).toBeNull();
    expect(noUpnp(snapshot({ params: { upnpAvailable: false } }))).toMatchObject({ severity: "info" });
    expect(noUpnp(snapshot({ params: {} }))).toBeNull();
    expect(noNatLoopback(snapshot({ params: { noNatLoopback: true, internalIp: "192.168.1.20" } })).why).toContain("192.168.1.20");
  });
  it("suggests remote access only when neither Remote Connect nor VPN is installed", () => {
    expect(remoteAccessMissing(snapshot())).toMatchObject({ severity: "info", dismissable: true });
    expect(remoteAccessMissing(snapshot({ packages: [pkg("remoteconnect.avado.dnp.dappnode.eth", { isCore: true })] }))).toBeNull();
  });
});

describe("storage", () => {
  it("disk-high parses percentages", () => {
    expect(parsePercent("12%")).toBe(12);
    expect(parsePercent(" 91 % ")).toBe(91);
    expect(parsePercent(87)).toBe(87);
    expect(parsePercent("")).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
    expect(parsePercent("n/a")).toBeNull();
  });
  it("parseDockerSize turns docker's human size strings into bytes", () => {
    expect(parseDockerSize("27.94GB")).toBeCloseTo(27.94e9);
    expect(parseDockerSize("1.572GB")).toBeCloseTo(1.572e9);
    expect(parseDockerSize("22.34MB")).toBeCloseTo(22.34e6);
    expect(parseDockerSize("17.3kB")).toBeCloseTo(17300);
    expect(parseDockerSize("63B")).toBe(63);
    expect(parseDockerSize("0B")).toBe(0);
    // Case-insensitive units, and a bare number (already bytes) passes through.
    expect(parseDockerSize("1KB")).toBe(1000);
    expect(parseDockerSize(1234)).toBe(1234);
    // Unparseable input never throws or returns NaN.
    expect(parseDockerSize("n/a")).toBe(0);
    expect(parseDockerSize(undefined)).toBe(0);
    expect(parseDockerSize(null)).toBe(0);
  });
  it("appDiskUse sums a package's volumes from docker's size strings", () => {
    const p = pkg("nimbus.avado.dnp.dappnode.eth", {
      volumes: [{ name: "data", size: "27.94GB" }, { name: "logs", size: "63B" }, { type: "bind", path: "/etc/hostname" }],
    });
    expect(appDiskUse(p)).toBeCloseTo(27.94e9 + 63);
  });
  it("warns at 80 %, is critical at 90 % and names the biggest apps", () => {
    const packages = [
      pkg("ethchain-geth.public.dappnode.eth", { volumes: [{ name: "data", size: 1.9e12 }] }),
      pkg("nimbus.avado.dnp.dappnode.eth", { volumes: [{ name: "data", size: 2e11 }] }),
    ];
    expect(diskHigh(snapshot({ stats: { disk: "79%" }, packages }))).toBeNull();
    expect(diskHigh(snapshot({ stats: { disk: "80%" }, packages })).severity).toBe("warning");
    const f = diskHigh(snapshot({ stats: { disk: "93%" }, packages }));
    expect(f.severity).toBe("critical");
    expect(f.why).toContain("ethchain-geth");
    expect(f.fix).toMatchObject({ kind: "link", to: "/system/storage" });
    expect(diskHigh(snapshot({ stats: {} }))).toBeNull();
  });
});

describe("diagnoses", () => {
  it("turns failing diagnoses into warnings, skipping disk and loading ones", () => {
    const diagnoses = [
      { id: "getDiagnoseIpfs", ok: false, msg: "IPFS is not resolving: timeout", solutions: ["Restart IPFS"] },
      { id: "getDiagnoseDiskSpace", ok: false, msg: "Disk usage is over 95%", solutions: [] },
      { id: "getDiagnoseDappmanagerConnected", loading: true, msg: "Checking" },
      { id: "getDiagnoseOpenPorts", ok: true, msg: "fine" },
    ];
    const out = diagnoseFailed(snapshot({ diagnoses }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "diagnose:getDiagnoseIpfs", severity: "warning", topic: "core", title: "IPFS is not resolving: timeout", steps: ["Restart IPFS"] });
  });
});
