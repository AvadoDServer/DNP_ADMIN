/**
 * Orders store categories for `/installer?category=<tag>`.
 *
 * When `tag` matches a known category, that category is moved to the front
 * (the rest keep their original, already weight-sorted order) and returned
 * as `highlighted` so the page can show a "Showing <description>" banner.
 * A missing or unknown tag is ignored: the categories are returned unchanged
 * and nothing is highlighted.
 *
 * @param {Array<{tag: string, description: string, weight: number}>} categories
 * @param {string|null|undefined} tag
 * @returns {{ordered: Array, highlighted: Object|undefined}}
 * [Tested]
 */
export default function orderCategoriesByFilter(categories, tag) {
  if (!Array.isArray(categories) || !tag)
    return { ordered: categories, highlighted: undefined };

  const highlighted = categories.find((cat) => cat && cat.tag === tag);
  if (!highlighted) return { ordered: categories, highlighted: undefined };

  const rest = categories.filter((cat) => cat !== highlighted);
  return { ordered: [highlighted, ...rest], highlighted };
}
