import confirmResetBeaconData from "pages/packages/components/confirmResetBeaconData";

const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));
vi.mock("components/ConfirmDialog", () => ({ confirm: mockConfirm }));

describe("confirmResetBeaconData", () => {
  it("says what goes, what stays and how long, in plain words, and calls back with the package name", () => {
    const pkg = { name: "teku.avado.dnp.dappnode.eth", volumes: [{ size: "883GB" }], manifest: { title: "Teku" } };
    const cb = vi.fn();
    confirmResetBeaconData(pkg, cb);
    const opts = mockConfirm.mock.calls[0][0];
    expect(opts.title).toBe("Free up space on Teku");
    expect(opts.label).toBe("Free up space");
    expect(opts.text).toBe(
      [
        "This deletes Teku's chain data (883.0 GB) and downloads a recent checkpoint instead.",
        "Kept: your validator keys, slashing protection and settings.",
        "Your validators are offline for about 15 to 30 minutes while Teku syncs again. Keep your AVADO on.",
      ].join("\n")
    );
    expect(cb).not.toHaveBeenCalled();
    opts.onClick();
    expect(cb).toHaveBeenCalledWith(pkg.name);
  });
});
