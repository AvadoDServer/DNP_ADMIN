import axios from "axios";
import relaysBundled from "./relays.bundled.json";

/**
 * The MEV-Boost relay list (relays.json from AVADO-DNP-MEV-Boost), as
 * published under the key `mev-relays`:
 *
 *   GET https://bo.ava.do/value/mev-relays -> "{\"schema\":1,...}"
 *
 * Asked once per page load and never polled. The Admin ships a copy of the
 * list (relays.bundled.json, refreshed with scripts/sync-relays.mjs); the
 * newer of the two by `updatedAt` is used. When the fetch fails or the answer
 * is not a relay list, the bundled copy is used and marked `stale`, so the
 * card can say it could not check for a newer one. Never rejects.
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) the bundled copy is
 * served without any network call.
 */

export const MOCK = Boolean(import.meta.env.REACT_APP_MOCK_DATA);
export const RELAYS_URL = "https://bo.ava.do/value/mev-relays";
export const BUNDLED = relaysBundled;
const TIMEOUT_MS = 8000;

const isObject = v => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = v => typeof v === "string" && v.length > 0;

/**
 * A relay list document, checked, or null. Takes a JSON string (encoded once
 * or twice) or an object. Every relay needs id, name, url and status as text
 * and recommended as true/false; a repeated url keeps only its first entry.
 */
export function parseRelayList(body) {
  let doc = body;
  // The value store hands back JSON inside a JSON string; decode up to twice.
  for (let i = 0; i < 2 && typeof doc === "string"; i++) {
    try {
      doc = JSON.parse(doc);
    } catch (e) {
      return null;
    }
  }
  if (!isObject(doc) || doc.schema !== 1 || !Array.isArray(doc.relays)) return null;
  const valid = doc.relays.every(
    r => isObject(r) && isText(r.id) && isText(r.name) && isText(r.url) && isText(r.status) && typeof r.recommended === "boolean"
  );
  if (!valid) return null;
  // One row per address: a repeated url keeps its first entry.
  const seen = new Set();
  const relays = doc.relays.filter(r => !seen.has(r.url) && seen.add(r.url));
  return relays.length === doc.relays.length ? doc : { ...doc, relays };
}

// The fetched list wins when it is at least as new as the bundled one; a
// list without an ISO date can't be shown to be newer.
function newer(fetched) {
  const date = /^\d{4}-\d{2}-\d{2}/.test(fetched.updatedAt) ? fetched.updatedAt : "";
  return date >= String(BUNDLED.updatedAt) ? fetched : BUNDLED;
}

let cached = null;

/** { list, stale }: the relay list to show. Never rejects. */
export function loadRelayList({ mock = MOCK, get = axios.get } = {}) {
  if (!cached) {
    cached = mock
      ? Promise.resolve({ list: BUNDLED, stale: false })
      : Promise.resolve()
          .then(() => get(RELAYS_URL, { timeout: TIMEOUT_MS }))
          .then(res => {
            const fetched = parseRelayList(res && res.data);
            return fetched ? { list: newer(fetched), stale: false } : { list: BUNDLED, stale: true };
          })
          .catch(() => ({ list: BUNDLED, stale: true }));
  }
  return cached;
}

/** For tests: forget the answer, as a page reload would. */
export function resetRelayListCache() {
  cached = null;
}
