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

async function query(q, fetchImpl) {
  const res = await fetchImpl(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw Error(`Prometheus HTTP error`);
  const body = await res.json();
  if (body.status !== "success") throw Error(body.error || "Prometheus query failed");
  return body.data.result.map(({ metric, value }) => ({
    client: metric.client,
    network: metric.network,
    value: Number(value[1]),
  }));
}

export async function fetchMetrics(fetchImpl = fetch) {
  try {
    const entries = await Promise.all(
      Object.entries(QUERIES).map(async ([key, q]) => [key, await query(q, fetchImpl)])
    );
    return Object.fromEntries(entries);
  } catch (e) {
    console.log(`Prometheus unavailable: ${e.message}`);
    return null;
  }
}
