import { fetchStore } from "services/store/fetchStore";

const { requestMock, axiosGetMock, axiosPostMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  axiosGetMock: vi.fn(),
  axiosPostMock: vi.fn(),
}));

vi.mock("react-jsonrpc-client", () => ({
  default: class JsonRpcClient {
    request(...args) {
      return requestMock(...args);
    }
  },
}));

vi.mock("axios", () => ({
  default: { get: axiosGetMock, post: axiosPostMock },
}));

describe("fetchStore", () => {
  beforeEach(() => {
    requestMock.mockReset();
    axiosGetMock.mockReset();
    axiosPostMock.mockReset().mockResolvedValue({});
  });

  it("fetches the catalogue hash over RPC, then the catalogue itself from the IPFS gateway", async () => {
    requestMock.mockResolvedValue(JSON.stringify({ hash: "Qm123", ipfsHostNodes: [] }));
    axiosGetMock.mockResolvedValue({ data: { packages: [{ name: "a" }], ipfsHostNodes: [] } });

    const result = await fetchStore({ nodeid: "0xabc", packages: [] });

    expect(result).toEqual({ packages: [{ name: "a" }], ipfsHostNodes: [] });
    expect(axiosGetMock).toHaveBeenCalledWith(expect.stringContaining("Qm123"), { timeout: 20000 });
  });

  it("times out the RPC call after 20s (store.getUpdates has no timeout of its own) instead of hanging forever", async () => {
    vi.useFakeTimers();
    try {
      // Never resolves on its own, same as an unreachable rpc.ava.do.
      requestMock.mockReturnValue(new Promise(() => {}));
      const pending = fetchStore({ nodeid: "0xabc", packages: [] });
      const assertion = expect(pending).rejects.toThrow(/timed out/);
      await vi.advanceTimersByTimeAsync(20000);
      await assertion;
      expect(axiosGetMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
