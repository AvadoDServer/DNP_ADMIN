import hideUserSetEnvs from "services/userActionLogs/hideUserSetEnvs";

describe("hideUserSetEnvs", () => {
  it("hides the values typed in the installer, keeps everything else", () => {
    const log = {
      level: "info",
      event: "installPackage.dappmanager.dnp.dappnode.eth",
      message: "Installed",
      timestamp: "2026-11-04T10:00:00Z",
      kwargs: { id: "tailscale.avado.dnp.dappnode.eth@/ipfs/Qm", userSetEnvs: { "tailscale.avado.dnp.dappnode.eth": { TS_AUTHKEY: "tskey-auth-secret" } }, userSetPorts: {} }
    };
    const out = hideUserSetEnvs(log);
    expect(JSON.stringify(out)).not.toContain("tskey-auth-secret");
    expect(out.kwargs.userSetEnvs).toEqual({ "tailscale.avado.dnp.dappnode.eth": { TS_AUTHKEY: "********" } });
    expect(out.kwargs.id).toBe(log.kwargs.id);
    expect(out.message).toBe("Installed");
    // the original is not changed
    expect(log.kwargs.userSetEnvs["tailscale.avado.dnp.dappnode.eth"].TS_AUTHKEY).toBe("tskey-auth-secret");
  });

  it("returns other logs as they are", () => {
    const log = { event: "restartPackage", kwargs: { id: "x" } };
    expect(hideUserSetEnvs(log)).toBe(log);
    expect(hideUserSetEnvs(undefined)).toBe(undefined);
  });
});

describe("hideUserSetEnvs: app Settings (updatePackageEnv)", () => {
  it("hides the values sent from the Settings tab, keeps the names", () => {
    const log = {
      level: "info",
      event: "updatePackageEnv.dappmanager.dnp.dappnode.eth",
      message: "Updated envs of vaultwarden.avado.dnp.dappnode.eth and restarted",
      kwargs: { id: "vaultwarden.avado.dnp.dappnode.eth", envs: { ADMIN_TOKEN: "s3cret-token", SIGNUPS_ALLOWED: "false" }, restart: true }
    };
    const out = hideUserSetEnvs(log);
    expect(JSON.stringify(out)).not.toContain("s3cret-token");
    expect(out.kwargs.envs).toEqual({ ADMIN_TOKEN: "********", SIGNUPS_ALLOWED: "********" });
    expect(out.kwargs.id).toBe(log.kwargs.id);
    expect(out.kwargs.restart).toBe(true);
    expect(log.kwargs.envs.ADMIN_TOKEN).toBe("s3cret-token");
  });

  it("works on an already redacted line from a newer DAPPMANAGER", () => {
    const log = { event: "updatePackageEnv", kwargs: { id: "x", envs: { A: "********" }, restart: true } };
    expect(hideUserSetEnvs(log).kwargs.envs).toEqual({ A: "********" });
  });
});
