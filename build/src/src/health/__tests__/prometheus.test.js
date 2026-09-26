import { fetchMetrics, QUERIES, PROMETHEUS_BASES, resetPrometheusBase } from "health/prometheus";

const ok = result => ({ ok: true, json: async () => ({ status: "success", data: { resultType: "vector", result } }) });
const httpError = () => ({ ok: false, json: async () => ({}) });
const sample = (client, network, value) => ({ metric: { client, network, job: client }, value: [1790103551, String(value)] });

const QUERY_COUNT = Object.keys(QUERIES).length;
const isProxyUrl = url => url.startsWith(PROMETHEUS_BASES[0]);
const isDirectUrl = url => url.startsWith(PROMETHEUS_BASES[1]);

beforeEach(() => {
  resetPrometheusBase();
});

describe("fetchMetrics", () => {
  it("queries every metric through the same-origin proxy by default and normalises samples", async () => {
    const fetchImpl = vi.fn(async url => {
      expect(isProxyUrl(url)).toBe(true);
      if (url.includes(encodeURIComponent(QUERIES.headSlot))) return ok([sample("nimbus", "mainnet", 15273292)]);
      if (url.includes(encodeURIComponent(QUERIES.peers))) return ok([sample("nimbus", "mainnet", 16)]);
      return ok([]);
    });
    const m = await fetchMetrics(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(QUERY_COUNT);
    expect(m.headSlot).toEqual([{ client: "nimbus", network: "mainnet", value: 15273292 }]);
    expect(m.peers[0].value).toBe(16);
    expect(m.attesterMiss).toEqual([]);
  });

  it("falls back to querying Prometheus directly when the proxy is unreachable", async () => {
    const fetchImpl = vi.fn(async url => {
      if (isProxyUrl(url)) return httpError(); // e.g. nginx 502
      expect(isDirectUrl(url)).toBe(true);
      return ok([sample("nimbus", "mainnet", 42)]);
    });
    const m = await fetchMetrics(fetchImpl);
    // Every query attempts the proxy first, then falls back to direct.
    expect(fetchImpl).toHaveBeenCalledTimes(QUERY_COUNT * 2);
    expect(m.headSlot).toEqual([{ client: "nimbus", network: "mainnet", value: 42 }]);
  });

  it("falls back to direct when the proxy throws a network error, not just an HTTP error", async () => {
    const fetchImpl = vi.fn(async url => {
      if (isProxyUrl(url)) throw TypeError("Failed to fetch");
      return ok([sample("nimbus", "mainnet", 7)]);
    });
    const m = await fetchMetrics(fetchImpl);
    expect(m.peers[0].value).toBe(7);
  });

  it("remembers the working base and tries it first on the next call", async () => {
    let proxyCalls = 0;
    const fetchImpl = vi.fn(async url => {
      if (isProxyUrl(url)) {
        proxyCalls++;
        return httpError();
      }
      return ok([sample("nimbus", "mainnet", 1)]);
    });
    await fetchMetrics(fetchImpl); // proxy fails once per query, falls back and remembers direct
    proxyCalls = 0;
    fetchImpl.mockClear();
    await fetchMetrics(fetchImpl);
    expect(proxyCalls).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(QUERY_COUNT);
    for (const [url] of fetchImpl.mock.calls) expect(isDirectUrl(url)).toBe(true);
  });

  it("resetPrometheusBase makes the proxy base be tried first again", async () => {
    const flaky = vi.fn(async url => (isProxyUrl(url) ? httpError() : ok([])));
    await fetchMetrics(flaky); // learns direct works
    resetPrometheusBase();
    const fetchImpl = vi.fn(async url => {
      expect(isProxyUrl(url)).toBe(true);
      return ok([]);
    });
    await fetchMetrics(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(QUERY_COUNT);
  });

  it("one failing query does not take down the others: its key is null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async url => {
      if (url.includes(encodeURIComponent(QUERIES.peers))) return httpError(); // fails on both bases
      if (url.includes(encodeURIComponent(QUERIES.headSlot))) return ok([sample("nimbus", "mainnet", 15273292)]);
      return ok([]);
    });
    const m = await fetchMetrics(fetchImpl);
    expect(m).not.toBeNull();
    expect(m.peers).toBeNull();
    expect(m.headSlot).toEqual([{ client: "nimbus", network: "mainnet", value: 15273292 }]);
    expect(m.attesterMiss).toEqual([]);
    expect(m.attesterHit).toEqual([]);
    expect(Object.keys(m).sort()).toEqual(Object.keys(QUERIES).sort());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("peers"));
    warn.mockRestore();
  });

  it("fetchMetrics returns null when every base fails", async () => {
    expect(await fetchMetrics(async () => { throw TypeError("Failed to fetch"); })).toBeNull();
    expect(await fetchMetrics(async () => httpError())).toBeNull();
    expect(await fetchMetrics(async () => ({ ok: true, json: async () => ({ status: "error", error: "bad" }) }))).toBeNull();
  });

  it("aborts a hung query after 10s per base (via AbortController) instead of hanging forever", async () => {
    vi.useFakeTimers();
    try {
      // Never resolves on its own; only settles (by rejecting) once the
      // AbortController's signal fires, exactly like a real fetch() would.
      // Both the proxy and direct attempts hang, so this exercises both
      // per-base timeouts before fetchMetrics gives up.
      const fetchImpl = vi.fn(
        (url, { signal } = {}) =>
          new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          })
      );
      const pending = fetchMetrics(fetchImpl);
      await vi.advanceTimersByTimeAsync(20000);
      expect(await pending).toBeNull();
      expect(fetchImpl.mock.calls.length).toBe(QUERY_COUNT * 2);
      for (const call of fetchImpl.mock.calls) expect(call[1].signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
