import { listLostData, findLostData, recoverLostData, RECOVER_TIMEOUT_MS, RECOVER_TIMEOUT_MESSAGE } from "pages/packages/lostDataApi";

const { api } = vi.hoisted(() => ({
  api: { listLostData: vi.fn(), findLostData: vi.fn(), recoverLostData: vi.fn() },
}));
vi.mock("API/rpcMethods", () => ({ default: api }));

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
});

describe("lostDataApi", () => {
  it("calls the DAPPMANAGER with the contract's kwargs", async () => {
    api.listLostData.mockResolvedValue([]);
    api.findLostData.mockResolvedValue({ package: "a", live: [], candidates: [] });
    api.recoverLostData.mockResolvedValue({ files: 3, sizeKb: 8 });
    await expect(listLostData()).resolves.toEqual([]);
    await expect(findLostData("a")).resolves.toEqual({ package: "a", live: [], candidates: [] });
    await expect(recoverLostData("a", "vol")).resolves.toEqual({ files: 3, sizeKb: 8 });
    expect(api.listLostData).toHaveBeenCalledWith({});
    expect(api.findLostData).toHaveBeenCalledWith({ id: "a" });
    expect(api.recoverLostData).toHaveBeenCalledWith({ id: "a", volume: "vol" });
  });

  it("passes the DAPPMANAGER's error on", async () => {
    api.recoverLostData.mockRejectedValue(Error("Recovering the data failed: MISSING ./x."));
    await expect(recoverLostData("a", "vol")).rejects.toThrow("Recovering the data failed: MISSING ./x.");
  });

  it("stops waiting for a recovery after 10 minutes", async () => {
    expect(RECOVER_TIMEOUT_MS).toBe(10 * 60 * 1000);
    vi.useFakeTimers();
    try {
      api.recoverLostData.mockReturnValue(new Promise(() => {}));
      const pending = recoverLostData("a", "vol");
      let done = false;
      pending.catch(() => {}).then(() => (done = true));
      const settled = expect(pending).rejects.toThrow(RECOVER_TIMEOUT_MESSAGE);
      await vi.advanceTimersByTimeAsync(RECOVER_TIMEOUT_MS - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });
});
