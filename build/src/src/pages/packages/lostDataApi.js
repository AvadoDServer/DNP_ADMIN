/**
 * A package's data in a storage volume no container uses (DAPPMANAGER 10.0.51
 * and newer; callers check canFindLostData first, so an older core never gets
 * these calls).
 *
 *   listLostData()               -> LostDataEntry[]  (only packages with candidates)
 *   findLostData(id)             -> LostDataEntry    (candidates: [] when none)
 *   recoverLostData(id, volume)  -> { files, sizeKb } (copies, never deletes; restarts the app)
 *
 *   LostDataEntry = { package, title?, live: [{ name, mountPath }],
 *     candidates: [{ name, anonymous, createdAt|null, entries: string[], sizeKb, target }] }
 *
 * Every call rejects on failure with the DAPPMANAGER's own message (no toast).
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) the calls are served
 * from mockLostData in src/mockState.js, so the Home finding and the
 * "Recover data" card can be seen without a box.
 */

export const MOCK = Boolean(import.meta.env.REACT_APP_MOCK_DATA);

// Copying a large volume can take minutes. The Admin's WAMP calls have no
// timeout of their own (autobahn waits for as long as the connection stays
// open), so the card stops waiting after 10 minutes; the copy itself goes on.
export const RECOVER_TIMEOUT_MS = 10 * 60 * 1000;
export const RECOVER_TIMEOUT_MESSAGE =
  "This is taking longer than expected. Your AVADO may still be copying the data. Reload this page in a few minutes to check.";

// Loaded on first use: API/rpcMethods brings the WAMP session and the whole
// redux store with it, which HealthProvider (and its tests) must not import.
const rpc = () => import("API/rpcMethods").then(m => m.default);

const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
const mockEntries = () =>
  import("../../mockState").then(m => JSON.parse(JSON.stringify(m.mockLostData || [])));

export function listLostData() {
  if (MOCK) return mockEntries().then(list => delay(list, 300));
  return rpc().then(api => api.listLostData({}));
}

export function findLostData(id) {
  if (MOCK)
    return mockEntries().then(list =>
      delay(list.find(e => e.package === id) || { package: id, live: [], candidates: [] }, 300)
    );
  return rpc().then(api => api.findLostData({ id }));
}

export function recoverLostData(id, volume, { timeoutMs = RECOVER_TIMEOUT_MS } = {}) {
  const call = MOCK
    ? mockEntries().then(list => {
        const entry = list.find(e => e.package === id);
        const candidate = entry && entry.candidates.find(c => c.name === volume);
        if (!candidate) throw Error("That volume is not on the list any more. Reload the page and try again.");
        return delay({ files: candidate.entries.length * 120, sizeKb: candidate.sizeKb }, 2000);
      })
    : rpc().then(api => api.recoverLostData({ id, volume }));
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(Error(RECOVER_TIMEOUT_MESSAGE)), timeoutMs);
  });
  return Promise.race([call, timeout]).finally(() => clearTimeout(timer));
}
