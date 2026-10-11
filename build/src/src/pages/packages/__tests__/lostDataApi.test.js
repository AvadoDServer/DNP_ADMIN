import { listLostData, findLostData, recoverLostData, recoveryInFlight, forgetRecovery, STILL_COPYING_AFTER_MS } from "pages/packages/lostDataApi";

const { api } = vi.hoisted(() => ({
  api: { listLostData: vi.fn(), findLostData: vi.fn(), recoverLostData: vi.fn() },
}));
vi.mock("API/rpcMethods", () => ({ default: api }));

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
});

describe("lostDataApi", () => {
  it("calls the DAPPMANAGER with the contract's kwargs", async () => {
    api.listLostData.mockResolvedValue([]);
    api.findLostData.mockResolvedValue({ package: "a", live: [], candidates: [], recovered: [] });
    api.recoverLostData.mockResolvedValue({ files: 3, sizeKb: 8, skipped: 0 });
    await expect(listLostData()).resolves.toEqual([]);
    await expect(findLostData("a")).resolves.toEqual({ package: "a", live: [], candidates: [], recovered: [] });
    await expect(recoverLostData("a", "vol")).resolves.toEqual({ files: 3, sizeKb: 8, skipped: 0 });
    expect(api.listLostData).toHaveBeenCalledWith({});
    expect(api.findLostData).toHaveBeenCalledWith({ id: "a" });
    expect(api.recoverLostData).toHaveBeenCalledWith({ id: "a", volume: "vol" });
  });

  it("passes the DAPPMANAGER's error on, word for word", async () => {
    const msg = "Recovering the data took longer than 10 minutes and was stopped. Files already copied were kept; contact AVADO support.";
    api.recoverLostData.mockRejectedValue(Error(msg));
    await expect(recoverLostData("a", "vol")).rejects.toThrow(msg);
  });

  it("never gives up on a recovery: it waits for the DAPPMANAGER, however long", async () => {
    vi.useFakeTimers();
    try {
      const call = deferred();
      api.recoverLostData.mockReturnValue(call.promise);
      let outcome = null;
      recoverLostData("a", "slow").then(
        r => (outcome = r),
        e => (outcome = e)
      );
      await vi.advanceTimersByTimeAsync(STILL_COPYING_AFTER_MS * 6);
      expect(outcome).toBeNull();
      call.resolve({ files: 9, sizeKb: 1, skipped: 0 });
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome).toEqual({ files: 9, sizeKb: 1, skipped: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a running recovery, so a second press joins it instead of starting another", async () => {
    const call = deferred();
    api.recoverLostData.mockReturnValue(call.promise);
    const first = recoverLostData("pkg", "vol");
    const second = recoverLostData("pkg", "vol");
    expect(second).toBe(first);
    const running = recoveryInFlight("pkg");
    expect(running).toMatchObject({ id: "pkg", volume: "vol", promise: first });
    expect(typeof running.startedAt).toBe("number");
    expect(recoveryInFlight("other")).toBeNull();
    call.resolve({ files: 1, sizeKb: 1, skipped: 0 });
    await first;
    expect(recoveryInFlight("pkg")).toBeNull();
    expect(api.recoverLostData).toHaveBeenCalledTimes(1);
  });

  it("forgets a recovery once it failed", async () => {
    api.recoverLostData.mockRejectedValue(Error("nope"));
    await expect(recoverLostData("pkg2", "vol")).rejects.toThrow("nope");
    expect(recoveryInFlight("pkg2")).toBeNull();
  });

  it("remembers the session a recovery was sent on, and can forget one whose answer is lost", async () => {
    const session = { id: "s1" };
    api.recoverLostData.mockReturnValue(new Promise(() => {}));
    recoverLostData("pkg3", "vol", { session });
    expect(recoveryInFlight("pkg3")).toMatchObject({ volume: "vol", session });
    forgetRecovery("pkg3", "vol");
    expect(recoveryInFlight("pkg3")).toBeNull();
  });
});
