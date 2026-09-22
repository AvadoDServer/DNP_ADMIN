// Client metrics from the monitoring package. Prometheus answers the Admin's
// origin with Access-Control-Allow-Origin (verified on the test box), so the
// browser can query it directly. Labels `client` and `network` are set by the
// AVADO Prometheus scrape config.
export const PROMETHEUS_URL = "http://prometheus.my.ava.do:9090";

export const QUERIES = {
  headSlot: "max by (client, network) (beacon_head_slot)",
  peers: 'max by (client, network) (libp2p_peers or p2p_peer_count{state="Connected"})',
  attesterMiss:
    "sum by (client, network) (increase(validator_monitor_prev_epoch_on_chain_attester_miss_total[1h]))",
  attesterHit:
    "sum by (client, network) (increase(validator_monitor_prev_epoch_on_chain_attester_hit_total[1h]))",
};

// A stuck/unreachable Prometheus (e.g. through Remote Connect, or a network
// blip) must not hang a query indefinitely — the 60s poll interval in
// HealthProvider would otherwise pile up more in-flight requests behind it.
const PROMETHEUS_TIMEOUT_MS = 10000;

async function query(q, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROMETHEUS_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw Error(`Prometheus HTTP error`);
    const body = await res.json();
    if (body.status !== "success") throw Error(body.error || "Prometheus query failed");
    return body.data.result.map(({ metric, value }) => ({
      client: metric.client,
      network: metric.network,
      value: Number(value[1]),
    }));
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMetrics(fetchImpl = fetch) {
  try {
    const entries = await Promise.all(
      Object.entries(QUERIES).map(async ([key, q]) => [key, await query(q, fetchImpl)])
    );
    return Object.fromEntries(entries);
  } catch (e) {
    console.warn(`Prometheus unavailable: ${e.message}`);
    return null;
  }
}
