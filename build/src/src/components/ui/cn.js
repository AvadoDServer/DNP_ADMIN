/**
 * Tiny classname joiner — filters falsy values and flattens.
 * Avoids pulling in clsx/classnames for a one-liner.
 */
export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default cn;
