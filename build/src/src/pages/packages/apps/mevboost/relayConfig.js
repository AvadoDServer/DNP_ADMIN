// Read and write the MEV-Boost package's RELAYS and EXTRA_OPTS settings, and
// line the box's relays up against the relay list (relays.json `relays`).
// Pure: no React, no network.
import parseManifestEnvs from "pages/installer/parsers/parseManifestEnvs";

const PUBKEY = /^0x[0-9a-f]{96}$/;
const MIN_BID_FLAG = /^--?min-bid(?:=(.*))?$/;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;

// Same rules as relayHost / relayPubkey in AVADO-DNP-MEV-Boost scripts/lib/relays.mjs.
function relayHost(url) {
  const after = String(url).split("@").pop().replace(/^https?:\/\//i, "");
  return after.replace(/\/+$/, "").toLowerCase();
}

function relayPubkey(url) {
  const m = /^https?:\/\/(0x[0-9a-fA-F]+)@/i.exec(String(url));
  if (!m) return null;
  const k = m[1].toLowerCase();
  return PUBKEY.test(k) ? k : null;
}

export function parseRelays(value) {
  return String(value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(url => ({ url, host: relayHost(url), pubkey: relayPubkey(url) }));
}

export function serialiseRelays(list) {
  return list.map(r => r.url).join(",");
}

// minBid: 0 when there is no minimum, null when the minimum can't be read
// (then rest is the whole value, untouched, and is written back as it was).
export function parseExtraOpts(value) {
  const original = String(value || "");
  const tokens = original.split(/\s+/).filter(Boolean);
  const at = tokens.map((t, i) => (MIN_BID_FLAG.test(t) ? i : -1)).filter(i => i >= 0);
  if (at.length === 0) return { minBid: 0, rest: original.trim() };
  const custom = { minBid: null, rest: original };
  if (at.length > 1) return custom;

  const i = at[0];
  const inline = MIN_BID_FLAG.exec(tokens[i])[1];
  const raw = inline !== undefined ? inline : tokens[i + 1];
  if (raw === undefined || !NUMBER.test(raw)) return custom;
  const used = inline !== undefined ? 1 : 2;
  const rest = [...tokens.slice(0, i), ...tokens.slice(i + used)].join(" ");
  return { minBid: Number(raw), rest };
}

// At most 4 decimals, so the value never prints in exponent form (1e-7).
const roundBid = n => Math.round(n * 10000) / 10000;

export function serialiseExtraOpts({ minBid, rest }) {
  const parts = [];
  if (rest && rest.trim()) parts.push(rest.trim());
  const bid = minBid > 0 ? roundBid(minBid) : 0;
  if (bid > 0) parts.push(`-min-bid ${bid}`);
  return parts.join(" ");
}

// MEV-Boost refuses to start with a minimum above 1 ETH.
export const MIN_BID_LOWEST = 0.001;
export const MIN_BID_HIGHEST = 1;

/** The amount typed in the card, in ETH: a number from 0.001 to 1, rounded to 4 decimals; null otherwise. */
export function readMinBid(text) {
  const t = String(text == null ? "" : text).trim();
  if (!NUMBER.test(t)) return null;
  const n = Number(t);
  return n >= MIN_BID_LOWEST && n <= MIN_BID_HIGHEST ? roundBid(n) : null;
}

/** A relay's "about" address when it is a plain https link (the list comes from the network); null otherwise. */
export function safeAboutUrl(value) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch (e) {
    return null;
  }
}

// Rows for the card: every list relay (ticked when the box has it with the same
// key), then each relay the list does not know, in the box's order.
export function mergeWithList(parsed, list) {
  const known = new Map(list.map(r => [relayHost(r.url), r]));
  const ticked = new Set();
  const customs = [];
  const seen = new Set();
  for (const p of parsed) {
    const relay = known.get(p.host);
    if (relay && relayPubkey(relay.url) === p.pubkey) {
      ticked.add(relay.id);
      continue;
    }
    const dedupe = `${p.host} ${p.pubkey}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    customs.push({
      id: `custom:${p.host}`,
      name: p.host,
      url: p.url,
      host: p.host,
      about: null,
      filtering: null,
      status: null,
      recommended: false,
      checked: true,
      custom: true,
      pubkeyMismatch: Boolean(relay),
    });
  }
  const rows = list.map(r => ({
    ...r,
    host: relayHost(r.url),
    checked: ticked.has(r.id),
    custom: false,
    pubkeyMismatch: false,
  }));
  return [...rows, ...customs];
}

/** The list's `updatedAt` as "October 11, 2026" (read as UTC); the value itself when it is not a date. */
export function listDate(value) {
  const date = new Date(value);
  if (typeof value !== "string" || isNaN(date.getTime())) return value == null ? "" : String(value);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// The card's rows for the package's settings: like mergeWithList, without the
// retired relays the box does not have (nothing to offer there).
export function cardRows(envs, list) {
  return mergeWithList(parseRelays(envs.RELAYS), list).filter(r => r.status !== "retired" || r.checked);
}

export function recommendedSelection(list) {
  return new Set(list.filter(r => r.recommended && r.status === "live").map(r => r.id));
}

export function applyRecommended(rows, list) {
  const selected = recommendedSelection(list);
  return rows.map(r => (r.custom ? r : { ...r, checked: selected.has(r.id) }));
}

export function toEnvs(rows, extra, currentEnvs) {
  return {
    ...currentEnvs,
    RELAYS: serialiseRelays(rows.filter(r => r.checked)),
    EXTRA_OPTS: serialiseExtraOpts(extra),
  };
}

// The package's current settings: manifest defaults overlaid by the box's values (as in Envs.jsx).
export function packageEnvs(dnp) {
  return {
    ...parseManifestEnvs(dnp.manifest),
    ...(dnp.envs || {}),
  };
}
