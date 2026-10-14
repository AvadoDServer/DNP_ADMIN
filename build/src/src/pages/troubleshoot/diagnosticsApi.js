/**
 * DAPPMANAGER getDiagnostics (10.0.53 and newer; callers check
 * canGetDiagnostics first, so an older core never gets the call).
 *
 *   getDiagnostics({ host, network, logs, clients }) -> {
 *     collectedAt, durationMs, errors, host, network, containers, clients }
 *
 * The diagnostics report asks for everything (`{}`, every probe on) and gives
 * up after DIAGNOSTICS_TIMEOUT_MS; the health poller (HealthProvider) asks
 * for the cheap part only (LIGHT: containers and the programs inside them).
 * The shape is documented by health/__tests__/fixtures-diagnostics.js.
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) the call is served from
 * that fixture: a healthy box, or with `?mock=teku-down` the box of
 * ticket-0928 (Teku's program stopped, the store unreachable, on Wi-Fi).
 */

// The DAPPMANAGER answers within 25 s; the report waits a little longer.
export const DIAGNOSTICS_TIMEOUT_MS = 30 * 1000;
// Containers and the programs inside them only (no host, network, logs or
// client probes): cheap enough for the health check every minute.
export const LIGHT = { host: false, network: false, logs: false, clients: false };

// Loaded on first use: API/rpcMethods brings the WAMP session and the whole
// redux store with it, which HealthProvider (and its tests) must not import.
const rpc = () => import("API/rpcMethods").then(m => m.default);

const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
const loadMock = () =>
  Promise.all([import("../../mockState"), import("health/__tests__/fixtures-diagnostics")]).then(([state, f]) =>
    state.mockScenario() === "teku-down" ? f.ticket0928.diagnostics : f.healthy.diagnostics
  );

export function getDiagnostics(kwargs = {}) {
  if (import.meta.env.REACT_APP_MOCK_DATA) return loadMock().then(d => delay(d, kwargs.logs === false ? 100 : 1500));
  return rpc().then(api => api.getDiagnostics(kwargs));
}

/** Rejects with "timed out after 30 s" when `promise` takes longer than `ms`. */
export function withTimeout(promise, ms = DIAGNOSTICS_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(`timed out after ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}
