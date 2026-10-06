// "News from AVADO": one news item at a time, published by AVADO under the
// key `admin-news` and shown on Home (components/NewsCard.jsx). This file is
// the pure part: reading the item, checking it, and remembering "Got it".
// The fetch lives in ./newsApi.
//
// The item comes from the network, so nothing in it is trusted: a field of
// the wrong shape drops the whole item, and a link is only kept when it
// points at ava.do over https.
import { kitFits } from "health/diskUpgrade";

export const NEWSLETTER_URL = "https://www.ava.do/#newsletter-email";
export const MAX_ID = 64;
export const MAX_TITLE = 80;
export const MAX_BODY = 400;
export const MAX_LINK_LABEL = 40;
const AUDIENCES = ["all", "small-disk"];

const DISMISSED_KEY = "avado.dismissedNews";
const MAX_DISMISSED = 20;

const isObject = v => typeof v === "object" && v !== null && !Array.isArray(v);

/** A string of 1 to `max` characters, trimmed; null for anything else. */
function text(value, max) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

/**
 * `until` as a timestamp (ms); NaN when it is not an ISO date. A date with
 * no time ("2026-11-01") lasts through the end of that day (UTC), so an item
 * "until the 1st" is still there on the 1st.
 */
function parseUntil(value) {
  if (typeof value !== "string") return NaN;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(`${v}T23:59:59.999Z`);
  return /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : NaN;
}

/**
 * The link of an item, if it is safe to show: the URL parses, is https, and
 * is on ava.do or one of its subdomains. Anything else gives null, and the
 * item is shown without a link.
 */
export function safeNewsLink(link) {
  if (!isObject(link)) return null;
  const label = text(link.label, MAX_LINK_LABEL);
  if (!label || typeof link.url !== "string") return null;
  let parsed;
  try {
    parsed = new URL(link.url.trim());
  } catch (e) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
  if (host !== "ava.do" && !host.endsWith(".ava.do")) return null;
  // The parsed form, so what was checked is exactly what gets rendered.
  return { label, url: parsed.href };
}

/**
 * The server's answer as a checked item, or null. The body is JSON inside a
 * JSON string ("{\"id\":...}"), so `data` may still be a string to parse.
 *
 *   { id, title, body, link?: { label, url }, until?, audience? }
 *
 * A wrong id, title, body, until or audience drops the item; a wrong link
 * only drops the link.
 */
export function parseNews(data) {
  let raw = data;
  // Twice: once for the JSON string, once more in case the outer layer was
  // not decoded on the way here.
  for (let i = 0; i < 2 && typeof raw === "string"; i++) {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (!isObject(raw)) return null;

  const id = text(raw.id, MAX_ID);
  const title = text(raw.title, MAX_TITLE);
  const body = text(raw.body, MAX_BODY);
  if (!id || !title || !body) return null;

  let until = null;
  if (raw.until !== undefined && raw.until !== null) {
    until = parseUntil(raw.until);
    if (!Number.isFinite(until)) return null;
  }

  // An audience this Admin does not know is meant for someone else: hide.
  const audience = raw.audience === undefined || raw.audience === null ? "all" : raw.audience;
  if (!AUDIENCES.includes(audience)) return null;

  return { id, title, body, link: safeNewsLink(raw.link), until, audience };
}

/** The item is for this box: everyone, or only the 2 TB i7 (see kitFits). */
export function matchesAudience(item, stats) {
  if (item.audience === "all") return true;
  return item.audience === "small-disk" && kitFits(stats);
}

/** Show the item: not past its date, for this box, and not dismissed. */
export function isNewsVisible(item, { now = Date.now(), stats, dismissed = [] } = {}) {
  if (!item) return false;
  if (item.until !== null && now > item.until) return false;
  if (!matchesAudience(item, stats)) return false;
  return !dismissed.includes(item.id);
}

/** Ids of the items the owner closed with "Got it", oldest first. */
export function readDismissedNews() {
  try {
    const list = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    return Array.isArray(list) ? list.filter(id => typeof id === "string") : [];
  } catch (e) {
    return [];
  }
}

/** Remember "Got it" for this id; only the last 20 ids are kept. */
export function dismissNews(id) {
  const list = readDismissedNews().filter(d => d !== id);
  list.push(id);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-MAX_DISMISSED)));
  } catch (e) {
    // Private mode or blocked storage: the item is back after a reload.
  }
}
