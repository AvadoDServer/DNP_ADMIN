import { SIMPLE_HIDDEN_STORE_CATEGORIES } from "settings/visibility";

/**
 * DappStore category visibility for Simple mode (spec §5: "DappStore |
 * Curated categories | All categories incl. testnets, 'The Lab', custom IPFS
 * hash box"). Categories in `SIMPLE_HIDDEN_STORE_CATEGORIES` are dropped in
 * simple mode, UNLESS they are the one deep-linked by `?category=<tag>`
 * (`categoryTag`) — a deep link to a hidden category still works, even in
 * simple mode (spec §5: deep links to Advanced-only pages are never 404s).
 * Advanced mode (or no mode given) returns every category unchanged.
 *
 * @param {Array<{tag: string}>} categories
 * @param {{mode?: string, categoryTag?: string|null}} [opts]
 */
export function visibleCategories(categories, { mode, categoryTag } = {}) {
  if (mode !== "simple" || !Array.isArray(categories)) return categories;
  return categories.filter(
    cat => cat.tag === categoryTag || !SIMPLE_HIDDEN_STORE_CATEGORIES.includes(cat.tag)
  );
}

/**
 * Search results always include every category (spec §5: "search still
 * finds everything"); in simple mode, results that live in a category
 * normally hidden from Simple are tagged so the store can show a small
 * "Advanced" badge next to them instead. Returns a Set of package names, or
 * `undefined` outside simple mode so callers can skip the badge entirely.
 *
 * @param {Array<{manifest: {name: string, avadocategory?: string}}>} matches
 * @param {string} mode
 * @returns {Set<string>|undefined}
 */
export function advancedMatchNames(matches, mode) {
  if (mode !== "simple") return undefined;
  return new Set(
    (matches || [])
      .filter(p => SIMPLE_HIDDEN_STORE_CATEGORIES.includes(p && p.manifest && p.manifest.avadocategory))
      .map(p => p.manifest.name)
  );
}
