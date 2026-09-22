import { fetchMetrics, QUERIES } from "health/prometheus";

const ok = result => ({ ok: true, json: async () => ({ status: "success", data: { resultType: "vector", result } }) });
const sample = (client, network, value) => ({ metric: { client, network, job: client }, value: [1790103551, String(value)] });

describe("fetchMetrics", () => {
  it("queries every metric and normalises samples", async () => {
    const fetchImpl = vi.fn(async url => {
      if (url.includes(encodeURIComponent(QUERIES.headSlot))) return ok([sample("nimbus", "mainnet", 15273292)]);
      if (url.includes(encodeURIComponent(QUERIES.peers))) return ok([sample("nimbus", "mainnet", 16)]);
      return ok([]);
    });
    const m = await fetchMetrics(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(m.headSlot).toEqual([{ client: "nimbus", network: "mainnet", value: 15273292 }]);
    expect(m.peers[0].value).toBe(16);
    expect(m.attesterMiss).toEqual([]);
  });

  it("fetchMetrics returns null on failure", async () => {
    expect(await fetchMetrics(async () => { throw TypeError("Failed to fetch"); })).toBeNull();
    expect(await fetchMetrics(async () => ({ ok: false, json: async () => ({}) }))).toBeNull();
    expect(await fetchMetrics(async () => ({ ok: true, json: async () => ({ status: "error", error: "bad" }) }))).toBeNull();
  });
});
