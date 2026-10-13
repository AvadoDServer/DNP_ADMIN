import { useEffect, useState } from "react";
import { formatDockerSize } from "health/rules/storage";

/**
 * Reset IPFS storage (DAPPMANAGER 10.0.52 and newer; callers check
 * canResetIpfsData first, so an older core never gets these calls).
 *
 *   getIpfsHealth() -> { exists, running, restarting, restartCount,
 *                        restartsLastHour, startedAt, lastLogLines, resetRunning }
 *   resetIpfsData() -> { removedKb, restarted, peersConnected, storePeersConnected }
 *     Empties the IPFS data volume (a cache of downloaded app packages) and
 *     starts IPFS again. Apps and their data are not touched.
 *
 * A reset is never given up on by the browser: it waits for the DAPPMANAGER's
 * answer however long it takes. The one running is kept here, keyed by the
 * call, so the Home finding and System > Storage show the same progress, a
 * second click never starts a second reset, and leaving the page keeps it.
 * A reset sent before the WAMP connection dropped never gets its answer
 * (autobahn does not settle it); getIpfsHealth's resetRunning settles it
 * instead (noteIpfsHealth). A reset this page did not start (another tab,
 * or before a reload) shows as running while resetRunning says so.
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) both calls are served
 * from mockIpfsHealth in src/mockState.js; open the Admin with
 * `?mock=ipfs-restarting` to see the finding.
 */

export const RESET_LABEL = "Reset IPFS storage";
export const PROGRESS_TEXT = "Resetting IPFS storage…";
const NOT_SURE =
  "Could not tell whether the reset finished. Reload the page; if IPFS still keeps restarting, contact AVADO support.";

// Loaded on first use: API/rpcMethods brings the WAMP session and the whole
// redux store with it, which HealthProvider (and its tests) must not import.
const rpc = () => import("API/rpcMethods").then(m => m.default);
const currentSession = () =>
  import("API/start").then(
    m => m.getSession(),
    () => null
  );

/* ---------------- mock (dev only) ---------------- */
let mockHealth = null;
const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
const loadMockHealth = () =>
  mockHealth
    ? Promise.resolve(mockHealth)
    : import("../../mockState").then(m => (mockHealth = mockHealth || m.mockIpfsHealth(m.mockScenario())));

/* ---------------- calls ---------------- */

export function getIpfsHealth() {
  if (import.meta.env.REACT_APP_MOCK_DATA)
    return loadMockHealth().then(h => delay({ ...h, resetRunning: Boolean(inFlight.size) }, 200));
  return rpc().then(api => api.getIpfsHealth({}));
}

function callReset() {
  if (import.meta.env.REACT_APP_MOCK_DATA)
    return loadMockHealth().then(() =>
      delay(null, 3000).then(() => {
        mockHealth = { ...mockHealth, running: true, restarting: false, restartCount: 0, restartsLastHour: 0, lastLogLines: [] };
        return { removedKb: 1258291, restarted: true, peersConnected: 14, storePeersConnected: 1 };
      })
    );
  return rpc().then(api => api.resetIpfsData({}));
}

/** "Done: 1.3 GB removed, IPFS is running again" */
export function resultText(result) {
  const kb = result && Number(result.removedKb);
  const removed = Number.isFinite(kb) && kb > 0 ? `${formatDockerSize(kb * 1024)} removed` : "IPFS storage emptied";
  return result && result.restarted === false
    ? `Done: ${removed}. IPFS is still starting; check again in a few minutes.`
    : `Done: ${removed}, IPFS is running again`;
}

/* ---------------- the reset in flight ---------------- */

const KEY = "resetIpfsData";
// KEY -> { promise, startedAt, session, origin }
const inFlight = new Map();
// The last reset of this page: { status: "running"|"done"|"error", text,
// origin, endedAt (ms, once ended), remote (seen only in getIpfsHealth) }
let state = null;
const listeners = new Set();
const setState = next => {
  state = next;
  for (const l of [...listeners]) l(state);
};

export function ipfsResetState() {
  return state;
}

export function subscribeIpfsReset(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Starts the reset, or returns the one already running. Settles with the
 * DAPPMANAGER's own answer; never rejects (the outcome is in the state).
 * origin: "finding" (Home) or "storage" (System > Storage)
 * toast: shows the progress and the result as a toast too
 */
export function startIpfsReset({ origin = "storage", resetImpl = callReset, toastImpl = null } = {}) {
  const running = inFlight.get(KEY);
  if (running) return running.promise;
  const toast = toastImpl ? toastImpl(PROGRESS_TEXT) : null;
  const entry = { startedAt: Date.now(), session: null, origin };
  setState({ status: "running", text: PROGRESS_TEXT, origin });
  const settle = (status, text) => {
    if (inFlight.get(KEY) !== entry) return;
    inFlight.delete(KEY);
    setState({ status, text, origin, endedAt: Date.now() });
    if (toast) toast.resolve({ success: status === "done", message: text });
  };
  if (!import.meta.env.REACT_APP_MOCK_DATA) currentSession().then(s => (entry.session = s));
  entry.promise = Promise.resolve()
    .then(() => resetImpl())
    .then(
      result => settle("done", resultText(result)),
      e => settle("error", (e && e.message) || "Resetting the IPFS storage failed. Try again.")
    );
  inFlight.set(KEY, entry);
  return entry.promise;
}

// A health answer that started before the DAPPMANAGER registered the reset
// can say resetRunning: false; a reset younger than this is never settled
// from the health when the session it was sent on is unknown.
const SETTLE_GRACE_MS = 30 * 1000;
const ipfsOk = health => Boolean(health.exists && health.running && !health.restarting);
const endedText = health =>
  ipfsOk(health) ? "The reset finished while this page was not connected. IPFS is running again." : NOT_SURE;

/**
 * Every getIpfsHealth answer:
 * - a reset sent on an earlier WAMP session (or on an unknown one, after a
 *   grace period) that the DAPPMANAGER no longer runs is over, but its
 *   answer is lost: the health says how it ended;
 * - a reset this page did not send but the DAPPMANAGER runs shows as
 *   running (the button stays busy), and ends when resetRunning does.
 */
export function noteIpfsHealth(health, { sessionImpl = currentSession, now = Date.now() } = {}) {
  if (!health || typeof health !== "object") return Promise.resolve();
  const entry = inFlight.get(KEY);
  if (!entry) {
    if (health.resetRunning && !(state && state.status === "running")) {
      setState({ status: "running", text: PROGRESS_TEXT, origin: "finding", remote: true });
    } else if (!health.resetRunning && state && state.remote && state.status === "running") {
      setState({ status: ipfsOk(health) ? "done" : "error", text: endedText(health), origin: "finding", endedAt: now });
    }
    return Promise.resolve();
  }
  if (health.resetRunning) return Promise.resolve();
  return Promise.resolve(sessionImpl()).then(session => {
    if (inFlight.get(KEY) !== entry) return;
    if (entry.session ? entry.session === session : now - entry.startedAt < SETTLE_GRACE_MS) return;
    inFlight.delete(KEY);
    setState({ status: ipfsOk(health) ? "done" : "error", text: endedText(health), origin: entry.origin, endedAt: now });
  });
}

/** React: the last reset of this page, updated while it runs. */
export function useIpfsReset() {
  const [value, setValue] = useState(state);
  useEffect(() => {
    setValue(state);
    return subscribeIpfsReset(setValue);
  }, []);
  return value;
}

// Tests only
export function _resetIpfsResetState() {
  inFlight.clear();
  state = null;
  mockHealth = null;
  listeners.clear();
}
