/**
 * A package's data in a storage volume no container uses (DAPPMANAGER 10.0.51
 * and newer; callers check canFindLostData first, so an older core never gets
 * these calls).
 *
 *   listLostData()               -> LostDataEntry[]  (only packages with candidates)
 *   findLostData(id)             -> LostDataEntry    (candidates: [] when none)
 *   recoverLostData(id, volume)  -> { files, sizeKb, skipped, warning? }
 *     Copies, never deletes; restarts the app. `files` counts the files in the
 *     old volume, `skipped` the ones already in the app's storage (kept).
 *     `warning` only when a skipped file looks like a wallet or password.
 *
 *   LostDataEntry = { package, title?, live: [{ name, mountPath }],
 *     candidates: [{ name, anonymous, confidence: "high"|"low", createdAt|null, entries: string[], sizeKb, target }],
 *       // confidence "high": named after this app; "low": an anonymous volume
 *       // that only looks like its data (never in listLostData; missing = high)
 *     recovered: [{ volume, at|null }] }   // recovered volumes leave `candidates`
 *
 * Every call rejects on failure with the DAPPMANAGER's own message (no toast).
 * A recovery is never given up on by the browser: it waits for the
 * DAPPMANAGER's answer, however long the copy takes (see STILL_COPYING_AFTER_MS).
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) the calls are served
 * from mockLostData in src/mockState.js, so the Home finding and the
 * "Recover data" card can be seen without a box.
 */

// After this long the card says the copy is still running (it keeps waiting).
export const STILL_COPYING_AFTER_MS = 10 * 60 * 1000;

// Loaded on first use: API/rpcMethods brings the WAMP session and the whole
// redux store with it, which HealthProvider (and its tests) must not import.
const rpc = () => import("API/rpcMethods").then(m => m.default);

/* ---------------- mock (dev only) ---------------- */
// `import.meta.env.REACT_APP_MOCK_DATA` is tested right at each branch (as
// index.jsx does) so the production build drops the mock chunk.
let mockStore = null;
const clone = v => JSON.parse(JSON.stringify(v));
const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
const mockEntries = () =>
  mockStore
    ? Promise.resolve(mockStore)
    : import("../../mockState").then(m => (mockStore = mockStore || clone(m.mockLostData || [])));
const mockRecover = (id, volume) =>
  mockEntries().then(list => {
    const entry = list.find(e => e.package === id);
    const candidate = entry && entry.candidates.find(c => c.name === volume);
    if (!candidate) throw Error("That volume is not on the list any more. Reload the page and try again.");
    return delay(null, 2000).then(() => {
      entry.candidates = entry.candidates.filter(c => c !== candidate);
      entry.recovered = [...(entry.recovered || []), { volume, at: new Date().toISOString() }];
      return {
        files: candidate.entries.length * 120,
        sizeKb: candidate.sizeKb,
        skipped: 2,
        warning:
          "Some files already existed in the app's storage and were kept; the copy from the old storage was not used for them.",
      };
    });
  });

/* ---------------- calls ---------------- */

export function listLostData() {
  if (import.meta.env.REACT_APP_MOCK_DATA)
    // Like the DAPPMANAGER: low-confidence candidates never reach the list.
    return mockEntries().then(list =>
      delay(
        clone(list)
          .map(e => ({ ...e, candidates: e.candidates.filter(c => c.confidence !== "low") }))
          .filter(e => e.candidates.length > 0),
        300
      )
    );
  return rpc().then(api => api.listLostData({}));
}

export function findLostData(id) {
  if (import.meta.env.REACT_APP_MOCK_DATA)
    return mockEntries().then(list =>
      delay(clone(list.find(e => e.package === id) || { package: id, live: [], candidates: [], recovered: [] }), 300)
    );
  return rpc().then(api => api.findLostData({ id }));
}

// Recoveries still waiting for the DAPPMANAGER, kept here (not in the card)
// so leaving the app page and coming back still shows them as running and
// never offers a second, parallel recovery. key: "<package>\n<volume>"
// Each remembers the WAMP session it was sent on: autobahn never settles a
// call whose connection dropped, so after a reconnect the card polls
// findLostData for the outcome instead of waiting on that promise.
const inFlight = new Map();
const keyOf = (id, volume) => `${id}\n${volume}`;

/** This package's recovery still running, or null: { id, volume, promise, startedAt, session }. */
export function recoveryInFlight(id) {
  for (const r of inFlight.values()) if (r.id === id) return r;
  return null;
}

/** Drops a recovery whose answer can no longer arrive (its connection dropped). */
export function forgetRecovery(id, volume) {
  inFlight.delete(keyOf(id, volume));
}

/**
 * Starts recovering `volume` into package `id`, or returns the recovery of it
 * already running. Settles only with the DAPPMANAGER's own answer.
 * `session`: the WAMP session it is sent on (redux connectionStatus).
 */
export function recoverLostData(id, volume, { session = null } = {}) {
  const key = keyOf(id, volume);
  const running = inFlight.get(key);
  if (running) return running.promise;
  const call = import.meta.env.REACT_APP_MOCK_DATA
    ? mockRecover(id, volume)
    : rpc().then(api => api.recoverLostData({ id, volume }));
  const promise = call.finally(() => inFlight.delete(key));
  inFlight.set(key, { id, volume, promise, startedAt: Date.now(), session });
  return promise;
}
