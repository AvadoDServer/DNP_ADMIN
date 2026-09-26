import { fetchMetrics, fetchDiskTrend, QUERIES, DISK_QUERIES, DISK_SERIES, PROMETHEUS_BASES, resetPrometheusBase } from "health/prometheus";

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

describe("fetchDiskTrend", () => {
  // An aggregated answer: one sample with no labels.
  const scalar = value => ok([{ metric: {}, value: [1790432127.69, String(value)] }]);
  const DISK_COUNT = Object.keys(DISK_QUERIES).length;
  const isDiskQuery = url => url.includes("node_filesystem_avail_bytes");
  // Test box numbers, 2026-09-26 (node-exporter 0.0.3, 3 days of data).
  const BOX = { free: 3670755098624, slope7d: -116708.24767425397, slope2d: -27224.815493410486, slopeHourly: -23428.052247141637, hoursOfData: 75 };
  const answerFor = url => {
    const key = Object.keys(DISK_QUERIES).find(k => url.includes(encodeURIComponent(DISK_QUERIES[k])));
    return key ? scalar(BOX[key]) : ok([]);
  };

  it("reads each disk query as one number", async () => {
    const fetchImpl = vi.fn(async url => answerFor(url));
    expect(await fetchDiskTrend(fetchImpl)).toEqual(BOX);
    expect(fetchImpl).toHaveBeenCalledTimes(DISK_COUNT);
    for (const [url] of fetchImpl.mock.calls) expect(isDiskQuery(url)).toBe(true);
  });

  it("the disk queries are separate from the chain metrics: fetchMetrics never asks for them", async () => {
    const fetchImpl = vi.fn(async () => ok([]));
    await fetchMetrics(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(QUERY_COUNT);
    for (const [url] of fetchImpl.mock.calls) expect(isDiskQuery(url)).toBe(false);
    for (const q of Object.values(DISK_QUERIES)) expect(Object.values(QUERIES)).not.toContain(q);
  });

  it("reads the host root on new (mountpoint /) and old (/host) node-exporter, never tmpfs, overlay or the EFI partition", () => {
    expect(DISK_SERIES).toContain('mountpoint=~"/|/host"');
    expect(DISK_SERIES).toContain('fstype!~"tmpfs|overlay|vfat"');
    for (const q of Object.values(DISK_QUERIES)) expect(q).toContain(DISK_SERIES);
  });

  it("an empty answer (no node-exporter yet) or a non-number is null", async () => {
    const fetchImpl = vi.fn(async url =>
      url.includes(encodeURIComponent(DISK_QUERIES.free)) ? scalar("NaN") : url.includes(encodeURIComponent(DISK_QUERIES.slope2d)) ? scalar("+Inf") : ok([])
    );
    expect(await fetchDiskTrend(fetchImpl)).toEqual({ free: null, slope7d: null, slope2d: null, slopeHourly: null, hoursOfData: null });
  });

  it("one failing disk query only nulls its own key", async () => {
    const fetchImpl = vi.fn(async url => (url.includes(encodeURIComponent(DISK_QUERIES.slopeHourly)) ? httpError() : answerFor(url)));
    expect(await fetchDiskTrend(fetchImpl)).toEqual({ ...BOX, slopeHourly: null });
  });

  it("is null when Prometheus can't be reached at all", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchDiskTrend(async () => { throw TypeError("Failed to fetch"); })).toBeNull();
    expect(await fetchDiskTrend(async () => httpError())).toBeNull();
    warn.mockRestore();
  });
});
