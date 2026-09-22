// @vitest-environment node
//
// This file reads theme.css off disk with real `fs` and does no DOM work.
// The suite's global `environment` is jsdom (needed by component tests), and
// under jsdom Vitest resolves Node builtins with browser conditions, so a
// plain `import fs from "fs"` there resolves to an empty stub, not the real
// module. This per-file pragma is Vitest's documented mechanism for exactly
// this case: https://vitest.dev/guide/environment.html#test-specific-environment
import fs from "fs";
import path from "path";

const css = fs.readFileSync(path.resolve(__dirname, "../../theme.css"), "utf8");

/** Token channels ("R G B") for a theme block selector. */
function tokens(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw Error(`selector ${selector} not found`);
  const block = css.slice(start, css.indexOf("}", start));
  const out = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g))
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
}

function luminance([r, g, b]) {
  const c = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const THEMES = { dark: '[data-theme="dark"]', light: '[data-theme="light"]' };

describe.each(Object.entries(THEMES))("%s theme contrast", (_, selector) => {
  const t = tokens(selector);
  it.each([
    ["fg", "bg", 4.5],
    ["fg", "surface", 4.5],
    ["fg-muted", "surface", 4.5],
    ["accent", "surface", 3],
    ["success", "surface", 3],
    ["warning", "surface", 3],
    ["danger", "surface", 3],
    ["brand", "surface", 3],
  ])("%s on %s ≥ %s", (fg, bg, min) => {
    expect(t[fg]).toBeDefined();
    expect(t[bg]).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});
