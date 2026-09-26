import api from "API/rpcMethods";
import { updatePackageEnv, setAutoUpdate } from "pages/packages/actions";

vi.mock("API/rpcMethods", () => ({ default: { updatePackageEnv: vi.fn(), setAutoUpdate: vi.fn() } }));

describe("updatePackageEnv", () => {
  it("saves the settings but never puts their values in the toast", () => {
    const envs = { EXECUTION_RPC: "http://user:hunter2@rpc.example:8545", GRAFANA_PASSWORD: "s3cret" };
    updatePackageEnv("nimbus.avado.dnp.dappnode.eth", envs)();

    expect(api.updatePackageEnv).toHaveBeenCalledTimes(1);
    const [kwargs, options] = api.updatePackageEnv.mock.calls[0];
    expect(kwargs).toEqual({ id: "nimbus.avado.dnp.dappnode.eth", envs, restart: true });
    expect(options.toastMessage).toBe("Saving settings for Nimbus…");
    expect(options.toastMessage).not.toContain("hunter2");
    expect(options.toastMessage).not.toContain("s3cret");
    expect(options.toastMessage).not.toContain("EXECUTION_RPC");
  });
});

describe("setAutoUpdate", () => {
  it("returns the call, which rejects on failure (the toast still reports it), so the switch can go back", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    api.setAutoUpdate.mockRejectedValueOnce(new Error("no such procedure"));
    await expect(setAutoUpdate("nimbus.avado.dnp.dappnode.eth", false)()).rejects.toThrow("no such procedure");
    const [kwargs, options] = api.setAutoUpdate.mock.calls[0];
    expect(kwargs).toEqual({ id: "nimbus.avado.dnp.dappnode.eth", autoUpdate: false });
    expect(options).toMatchObject({ toastMessage: "Changing Auto-update to false", throw: true });
    log.mockRestore();
  });
});
