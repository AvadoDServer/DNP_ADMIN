# Admin self-help UX overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the AVADO Admin into a self-help tool: a health verdict with actionable findings on Home, a guided Help troubleshooter with a diagnostics report, a Staking setup checklist, tabbed app pages, System Updates/Storage/History, a ⌘K palette, and a visual refresh aligned with www.ava.do.

**Architecture:** A pure `src/health/` engine (rules over a snapshot of redux state + store updates + Prometheus metrics) feeds a `HealthProvider` context mounted once in `App.jsx`. Pages read findings through `useHealth()`. All data comes from what the Admin already receives (WAMP-backed redux, `rpc.ava.do` store, IPFS gateway, Prometheus at `prometheus.my.ava.do:9090`); no DAPPMANAGER/WAMP change.

**Tech Stack:** React 18, react-router-dom 5, redux 4 + react-redux 7.2 hooks, reselect, Vite 5, Tailwind 3.4 on `theme.css` RGB-channel tokens, Vitest 2 + Testing Library + jsdom (new), `@fontsource` fonts (new).

**Spec:** `docs/superpowers/specs/2026-09-22-admin-self-help-ux-design.md`

All paths below are relative to `build/src/` unless they start with `docs/`. Run every command from `build/src/`.

## Global Constraints

- Admin-only release: no change to DAPPMANAGER, WAMP API, crossbar config; no new WAMP calls; no security hardening.
- Offline-tolerant: fonts bundled via `@fontsource`; every external fetch (`rpc.ava.do`, IPFS gateway, Prometheus) may fail and must degrade to a finding or a quiet empty state, never a crash.
- Use `components/ui` for new UI; Tailwind classes on existing tokens (`bg-surface`, `text-fg-muted`, `border-border`, …) plus the new `brand` and `verdict-*` tokens.
- Copy: sentence case everywhere, no all-caps labels, plain verbs; an action keeps the same name through its flow.
- Diagnostics report never includes env values, keys, logs, or IPs other than the internal IP.
- No page may be blank, truncated or horizontally scrolling at 360, 768 and 1440 px, in dark and light themes.
- Finding shape, snapshot shape and verdict words exactly as in spec §4.1.
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Box without internet** (store fetch rejects): Home, Help and Updates still render; a `store-unreachable` info finding explains it. → test in Task 7 (`updates-store-unreachable`) and Task 9 (`useHealth store failure`).
2. **Custom/legacy package without manifest, title, avatar or version** (IPFS installs): cards show the container name, rules skip it without throwing. → test in Task 5 (`rules tolerate manifest-less packages`) and Task 10 (`AppAvatar fallback`).
3. **Monitoring installed but Prometheus down, CORS-blocked or returning an error**: metrics become `null`, `sources.metrics` explains, chain rules return nothing. → test in Task 8 (`fetchMetrics returns null on failure`).
4. **Stats not loaded yet or in string form** (`disk: ""`, `"12%"`, `undefined`): disk rule parses safely and returns nothing when unknown. → test in Task 7 (`disk-high parses percentages`).
5. **Long app titles on a 360 px phone**: text wraps, cards never overflow. → browser check in Task 13 and Task 22, plus `break-words` asserted in Task 10's AppCard test.

---

### Task 1: Test runner (Vitest) and bundled fonts

**Files:**
- Modify: `package.json` (scripts.test, devDependencies, dependencies)
- Modify: `vite.config.mjs` (add `test` block)
- Create: `src/setupTests.js`
- Create: `src/utils/__tests__/smoke.test.js`
- Modify: `src/index.css:2` (remove Google Fonts `@import`)
- Modify: `src/index.jsx` (import fonts)

**Interfaces:**
- Produces: `npm test` runs Vitest once; `@testing-library/jest-dom` matchers available globally; module aliases (`health/...`, `components/...`) resolve in tests exactly as in the app.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install --save-dev vitest@^2.1 jsdom@^25 @testing-library/react@^16 @testing-library/dom@^10 @testing-library/jest-dom@^6
npm install @fontsource/sen@^5 @fontsource/inter@^5 @fontsource/jetbrains-mono@^5
```
Expected: installs without peer-dependency errors (Vitest 2 supports Vite 5).

- [ ] **Step 2: Add the test block to `vite.config.mjs`**

Inside the object returned by `defineConfig`, after `build: {...}`, add:
```js
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/setupTests.js",
      include: ["src/**/*.test.{js,jsx}"],
    },
```

- [ ] **Step 3: Create `src/setupTests.js`**

```js
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Set the test script in `package.json`**

Replace the `"test"` script with:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test that proves aliases resolve**

`src/utils/__tests__/smoke.test.js`:
```js
import { cn } from "components/ui/cn";

describe("test setup", () => {
  it("resolves src aliases", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: `1 passed`. If `cn` joins differently, adjust the expectation to its real output (read `src/components/ui/cn.js`), not the implementation.

- [ ] **Step 7: Bundle the fonts**

Delete line 2 of `src/index.css` (the `@import url("https://fonts.googleapis.com/...")`). At the top of `src/index.jsx`, before the other CSS imports, add:
```js
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/sen/600.css";
import "@fontsource/sen/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
```

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: build succeeds; `build/assets` contains `.woff2` files for Inter, Sen and JetBrains Mono.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.mjs src/setupTests.js src/utils/__tests__/smoke.test.js src/index.css src/index.jsx
git commit -m "chore: Vitest test runner and bundled fonts"
```

---

### Task 2: Design tokens (brand, verdict, display font) with a contrast test

**Files:**
- Modify: `src/theme.css` (dark and light token values; new `--brand`, `--brand-subtle`, `--verdict-ok`, `--verdict-warn`, `--verdict-crit`)
- Modify: `tailwind.config.js` (colors `brand`, `verdict`; `fontFamily.display`)
- Create: `src/theme/__tests__/contrast.test.js`

**Interfaces:**
- Produces: Tailwind classes `bg-brand`, `text-brand`, `bg-brand-subtle`, `bg-verdict-ok`, `bg-verdict-warn`, `bg-verdict-crit`, `font-display`.

- [ ] **Step 1: Write the failing contrast test**

`src/theme/__tests__/contrast.test.js`:
```js
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
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/theme`
Expected: FAIL — `brand` undefined (and possibly light `warning`/`success` below 3).

- [ ] **Step 3: Update `src/theme.css`**

In the dark block (`:root, [data-theme="dark"]`) set these values (channels), leaving the other tokens as they are:
```css
  --bg: 7 12 24;
  --bg-subtle: 11 18 34;
  --surface: 15 23 41;
  --surface-hover: 21 31 54;
  --surface-raised: 22 32 58;
  --border: 34 48 83;
  --border-strong: 50 66 104;
  --fg: 237 242 250;
  --fg-muted: 154 167 192;
  --accent: 80 133 245;          /* signal #5085F5 */
  --accent-hover: 110 155 247;
  --accent-active: 58 112 226;
  --brand: 122 203 199;          /* tide #7ACBC7 */
  --brand-subtle: 20 44 50;
  --success: 61 203 138;
  --warning: 242 184 75;
  --danger: 242 100 100;
  --verdict-ok: 17 38 48;
  --verdict-warn: 44 36 22;
  --verdict-crit: 48 24 32;
```
In the light block (`[data-theme="light"]`) set:
```css
  --bg: 243 245 249;
  --surface: 255 255 255;
  --border: 220 226 236;
  --fg: 14 24 48;
  --fg-muted: 74 87 115;
  --accent: 47 107 232;
  --brand: 46 143 138;
  --brand-subtle: 224 242 241;
  --success: 22 137 90;
  --warning: 168 106 0;
  --danger: 198 47 47;
  --verdict-ok: 230 245 244;
  --verdict-warn: 253 243 224;
  --verdict-crit: 252 232 232;
```
If a token does not exist yet in a block, add it; keep the triplet format `R G B;`.

- [ ] **Step 4: Extend `tailwind.config.js`**

In `theme.extend.colors` add:
```js
        brand: { DEFAULT: ch('--brand'), subtle: ch('--brand-subtle') },
        verdict: { ok: ch('--verdict-ok'), warn: ch('--verdict-warn'), crit: ch('--verdict-crit') },
```
In `theme.extend.fontFamily` add:
```js
        display: ['Sen', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/theme`
Expected: PASS for both themes. If a pair fails, darken (light) or lighten (dark) that status token until it passes; do not lower the threshold.

- [ ] **Step 6: Commit**

```bash
git add src/theme.css tailwind.config.js src/theme/__tests__/contrast.test.js
git commit -m "feat(theme): brand and verdict tokens aligned with ava.do, contrast-tested"
```

---

### Task 3: Client roles and networks table

**Files:**
- Create: `src/health/clients.js`
- Test: `src/health/__tests__/clients.test.js`

**Interfaces:**
- Produces:
  - `ROLES = { EXECUTION: "execution", CONSENSUS: "consensus", VALIDATOR: "validator", MEV: "mev", MONITORING: "monitoring", REMOTE: "remote" }`
  - `NETWORKS: { [network]: { label, genesis (unix s), slotSeconds, slotsPerEpoch } }`
  - `getClient(name) → { name, role, network, label, promClient?, canResetData, pruneAdvice } | null`
  - `clientsByRole(packages, role) → Array<{ pkg, client }>` for installed packages
  - `currentSlot(network, nowMs) → number | null`

- [ ] **Step 1: Write the failing test**

`src/health/__tests__/clients.test.js`:
```js
import { getClient, clientsByRole, currentSlot, ROLES, NETWORKS } from "health/clients";

describe("client table", () => {
  it("knows the AVADO mainnet clients from the store", () => {
    expect(getClient("nimbus.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "mainnet", promClient: "nimbus" });
    expect(getClient("teku.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.CONSENSUS, network: "mainnet" });
    expect(getClient("ethchain-geth.public.dappnode.eth")).toMatchObject({ role: ROLES.EXECUTION, network: "mainnet", canResetData: true });
    expect(getClient("avado-dnp-nethermind.public.dappnode.eth")).toMatchObject({ role: ROLES.EXECUTION, network: "mainnet" });
    expect(getClient("grafana.avado.dappnode.eth")).toMatchObject({ role: ROLES.MONITORING });
    expect(getClient("mevboost.avado.dnp.dappnode.eth")).toMatchObject({ role: ROLES.MEV, network: "mainnet" });
  });

  it("never offers a data reset for consensus clients (validator keys live there)", () => {
    for (const name of ["nimbus.avado.dnp.dappnode.eth", "teku.avado.dnp.dappnode.eth", "eth2validator.avado.dnp.dappnode.eth"])
      expect(getClient(name).canResetData).toBe(false);
  });

  it("returns null for unknown packages", () => {
    expect(getClient("my-custom.public.dappnode.eth")).toBeNull();
    expect(getClient(undefined)).toBeNull();
  });

  it("filters installed packages by role", () => {
    const packages = [
      { name: "nimbus.avado.dnp.dappnode.eth" },
      { name: "grafana.avado.dappnode.eth" },
      { name: "unknown.dnp.dappnode.eth" },
    ];
    const cc = clientsByRole(packages, ROLES.CONSENSUS);
    expect(cc).toHaveLength(1);
    expect(cc[0].pkg.name).toBe("nimbus.avado.dnp.dappnode.eth");
  });

  it("computes the current mainnet slot from the wall clock", () => {
    // 1790103551 s → slot 15 273 294 on mainnet (verified against the test box)
    expect(currentSlot("mainnet", 1790103551 * 1000)).toBe(15273294);
    expect(currentSlot("nowhere", Date.now())).toBeNull();
    expect(NETWORKS.gnosis.slotSeconds).toBe(5);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/health/__tests__/clients.test.js`
Expected: FAIL — cannot resolve `health/clients`.

- [ ] **Step 3: Implement `src/health/clients.js`**

```js
// Which installed AVADO package plays which role on which network.
// Names come from the DappStore manifest (verified 2026-09-22) and the
// Prometheus job list in AVADO-DNP-Prometheus. Unknown packages return null
// and are ignored by role-based checks.

export const ROLES = {
  EXECUTION: "execution",
  CONSENSUS: "consensus",
  VALIDATOR: "validator",
  MEV: "mev",
  MONITORING: "monitoring",
  REMOTE: "remote",
};

export const NETWORKS = {
  mainnet: { label: "Ethereum mainnet", genesis: 1606824023, slotSeconds: 12, slotsPerEpoch: 32 },
  holesky: { label: "Holesky testnet", genesis: 1695902400, slotSeconds: 12, slotsPerEpoch: 32 },
  goerli: { label: "Goerli testnet (retired)", genesis: 1616508000, slotSeconds: 12, slotsPerEpoch: 32 },
  gnosis: { label: "Gnosis chain", genesis: 1638993340, slotSeconds: 5, slotsPerEpoch: 16 },
};

const EXECUTION_PRUNE =
  "Execution clients keep the whole chain state and grow over time. Resetting its data makes it sync again from scratch (several hours to a few days). No validator keys are stored in an execution client, so this is safe, but your validators cannot attest until it is synced again.";
const CONSENSUS_PRUNE =
  "Consensus clients normally stay under 200 GB. If yours is much larger, contact support: its data folder also holds your validator keys and slashing protection, so never delete it yourself.";

const table = [
  // Execution
  ["ethchain-geth.public.dappnode.eth", ROLES.EXECUTION, "mainnet", "Geth", "geth"],
  ["avado-dnp-nethermind.public.dappnode.eth", ROLES.EXECUTION, "mainnet", "Nethermind", "nethermind"],
  ["holesky-geth.avado.dnp.dappnode.eth", ROLES.EXECUTION, "holesky", "Geth (Holesky)", "geth"],
  ["goerli-geth.avado.dnp.dappnode.eth", ROLES.EXECUTION, "goerli", "Geth (Goerli)", "geth"],
  ["nethermind-gnosis.avado.dnp.dappnode.eth", ROLES.EXECUTION, "gnosis", "Nethermind (Gnosis)", "nethermind"],
  // Consensus (beacon + validator in one package, except Prysm)
  ["nimbus.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "mainnet", "Nimbus", "nimbus"],
  ["nimbus-holesky.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "holesky", "Nimbus (Holesky)", "nimbus"],
  ["nimbus-prater.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "goerli", "Nimbus (Prater)", "nimbus"],
  ["teku.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "mainnet", "Teku", "teku"],
  ["teku-holesky.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "holesky", "Teku (Holesky)", "teku"],
  ["teku-prater.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "goerli", "Teku (Prater)", "teku"],
  ["teku-gnosis.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "gnosis", "Teku (Gnosis)", "teku"],
  ["prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "mainnet", "Prysm beacon chain", "prysm"],
  ["eth2validator.avado.dnp.dappnode.eth", ROLES.CONSENSUS, "mainnet", "Prysm", "prysm"],
  // Tooling
  ["mevboost.avado.dnp.dappnode.eth", ROLES.MEV, "mainnet", "MEV-Boost"],
  ["grafana.avado.dappnode.eth", ROLES.MONITORING, null, "Grafana"],
  ["prometheus.avado.dappnode.eth", ROLES.MONITORING, null, "Prometheus"],
  ["node-exporter.avado.dappnode.eth", ROLES.MONITORING, null, "Node exporter"],
  ["remoteconnect.avado.dnp.dappnode.eth", ROLES.REMOTE, null, "Remote Connect"],
  ["vpn.dnp.dappnode.eth", ROLES.REMOTE, null, "VPN"],
];

const byName = Object.fromEntries(
  table.map(([name, role, network, label, promClient]) => [
    name,
    {
      name,
      role,
      network,
      label,
      promClient,
      canResetData: role === ROLES.EXECUTION,
      pruneAdvice:
        role === ROLES.EXECUTION ? EXECUTION_PRUNE : role === ROLES.CONSENSUS ? CONSENSUS_PRUNE : null,
    },
  ])
);

export const PROMETHEUS_PACKAGE = "prometheus.avado.dappnode.eth";
export const GRAFANA_PACKAGE = "grafana.avado.dappnode.eth";

export function getClient(name) {
  return (name && byName[name]) || null;
}

export function clientsByRole(packages, role) {
  return (packages || [])
    .map(pkg => ({ pkg, client: getClient(pkg && pkg.name) }))
    .filter(({ client }) => client && client.role === role);
}

export function currentSlot(network, nowMs) {
  const n = NETWORKS[network];
  if (!n) return null;
  return Math.floor((nowMs / 1000 - n.genesis) / n.slotSeconds);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/health/__tests__/clients.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/health/clients.js src/health/__tests__/clients.test.js
git commit -m "feat(health): client roles and network table"
```

---

### Task 4: Checks engine (runChecks, verdict, severity order)

**Files:**
- Create: `src/health/engine.js`
- Test: `src/health/__tests__/engine.test.js`

**Interfaces:**
- Produces:
  - `SEVERITIES = ["critical", "warning", "info"]`, `TOPICS = ["setup", "sync", "attestations", "updates", "access", "storage", "core"]`
  - `runChecks(snapshot, rules) → Finding[]` — each rule is `(snapshot) => Finding | Finding[] | null`; errors are caught (`console.error`) and skipped; output sorted by severity index, then topic index, then title.
  - `verdictOf(findings) → { level: "critical" | "warning" | "ok", label: "Action required" | "Needs attention" | "All good" }`

- [ ] **Step 1: Write the failing test**

`src/health/__tests__/engine.test.js`:
```js
import { runChecks, verdictOf } from "health/engine";

const f = (id, severity, topic = "core") => ({ id, severity, topic, title: id, why: "", fix: null });

describe("runChecks", () => {
  it("flattens, drops nulls and sorts by severity then topic", () => {
    const rules = [
      () => f("info-a", "info", "access"),
      () => null,
      () => [f("warn-b", "warning", "storage"), f("crit-c", "critical", "sync")],
      () => f("warn-a", "warning", "setup"),
    ];
    expect(runChecks({}, rules).map(x => x.id)).toEqual(["crit-c", "warn-a", "warn-b", "info-a"]);
  });

  it("isolates a rule that throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rules = [() => { throw Error("boom"); }, () => f("ok", "info")];
    expect(runChecks({}, rules).map(x => x.id)).toEqual(["ok"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("verdictOf", () => {
  it("is critical when any finding is critical", () => {
    expect(verdictOf([f("a", "info"), f("b", "critical")])).toEqual({ level: "critical", label: "Action required" });
  });
  it("is warning when the worst is a warning", () => {
    expect(verdictOf([f("a", "warning")])).toEqual({ level: "warning", label: "Needs attention" });
  });
  it("is ok with only info findings or none", () => {
    expect(verdictOf([f("a", "info")])).toEqual({ level: "ok", label: "All good" });
    expect(verdictOf([])).toEqual({ level: "ok", label: "All good" });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/health/__tests__/engine.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/health/engine.js`**

```js
export const SEVERITIES = ["critical", "warning", "info"];
export const TOPICS = ["setup", "sync", "attestations", "updates", "access", "storage", "core"];

const rank = (list, value) => {
  const i = list.indexOf(value);
  return i === -1 ? list.length : i;
};

/**
 * Run every rule over the snapshot. A rule returns a finding, an array of
 * findings, or null. One failing rule must never hide the others.
 */
export function runChecks(snapshot, rules) {
  const findings = [];
  for (const rule of rules) {
    try {
      const out = rule(snapshot);
      if (Array.isArray(out)) findings.push(...out.filter(Boolean));
      else if (out) findings.push(out);
    } catch (e) {
      console.error(`Health rule ${rule.name || "(anonymous)"} failed`, e);
    }
  }
  return findings.sort(
    (a, b) =>
      rank(SEVERITIES, a.severity) - rank(SEVERITIES, b.severity) ||
      rank(TOPICS, a.topic) - rank(TOPICS, b.topic) ||
      String(a.title).localeCompare(String(b.title))
  );
}

export function verdictOf(findings) {
  if (findings.some(f => f.severity === "critical")) return { level: "critical", label: "Action required" };
  if (findings.some(f => f.severity === "warning")) return { level: "warning", label: "Needs attention" };
  return { level: "ok", label: "All good" };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/health/__tests__/engine.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/health/engine.js src/health/__tests__/engine.test.js
git commit -m "feat(health): checks engine with verdict and error isolation"
```

---

### Task 5: Rules — apps, core and setup

**Files:**
- Create: `src/health/rules/apps.js`
- Create: `src/health/rules/setup.js`
- Create: `src/health/__tests__/fixtures.js`
- Test: `src/health/__tests__/rules-apps-setup.test.js`

**Interfaces:**
- Consumes: `getClient`, `clientsByRole`, `ROLES`, `GRAFANA_PACKAGE`, `PROMETHEUS_PACKAGE` (Task 3).
- Produces: named rule functions `appStopped`, `appRestarting`, `coreAppDown` (apps.js); `consensusWithoutExecution`, `executionWithoutConsensus`, `monitoringMissing` (setup.js). Helper `appTitle(pkg)` exported from apps.js: `manifest.title || shortName`.
- Fixture builders in `fixtures.js`: `pkg(name, overrides)`, `snapshot(overrides)`.

- [ ] **Step 1: Create fixtures**

`src/health/__tests__/fixtures.js`:
```js
export const pkg = (name, overrides = {}) => ({
  name,
  id: name,
  state: "running",
  running: true,
  isCore: false,
  version: "1.0.0",
  volumes: [],
  manifest: { name, title: name.split(".")[0], version: "1.0.0" },
  ...overrides,
});

export const snapshot = (overrides = {}) => ({
  packages: [],
  stats: {},
  params: {},
  diagnoses: [],
  chainData: [],
  updates: {},
  coreUpdate: { available: false },
  metrics: null,
  sources: { updates: "ok", metrics: "not-installed" },
  now: 1790103551 * 1000,
  ...overrides,
});
```

- [ ] **Step 2: Write the failing tests**

`src/health/__tests__/rules-apps-setup.test.js`:
```js
import { appStopped, appRestarting, coreAppDown } from "health/rules/apps";
import { consensusWithoutExecution, executionWithoutConsensus, monitoringMissing } from "health/rules/setup";
import { pkg, snapshot } from "./fixtures";

const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
const GETH = "ethchain-geth.public.dappnode.eth";

describe("appStopped", () => {
  it("flags an exited client as critical with a start action", () => {
    const s = snapshot({ packages: [pkg(NIMBUS, { state: "exited", running: false, manifest: { title: "Nimbus Consensus Client" } })] });
    const [f] = appStopped(s);
    expect(f).toMatchObject({ id: `app-stopped:${NIMBUS}`, severity: "critical", topic: "sync", appId: NIMBUS });
    expect(f.title).toBe("Nimbus Consensus Client is stopped");
    expect(f.fix).toMatchObject({ kind: "action", action: "startPackage", label: "Start it" });
  });
  it("is a warning for non-client apps and ignores core and running apps", () => {
    const s = snapshot({ packages: [
      pkg("rotki.avado.dnp.dappnode.eth", { state: "exited", running: false }),
      pkg("ipfs.dnp.dappnode.eth", { state: "exited", running: false, isCore: true }),
      pkg(GETH),
    ] });
    const out = appStopped(s);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
  });
});

describe("appRestarting", () => {
  it("flags a restarting app with a link to its logs", () => {
    const [f] = appRestarting(snapshot({ packages: [pkg(NIMBUS, { state: "restarting", running: true })] }));
    expect(f).toMatchObject({ severity: "critical", fix: { kind: "link", to: `/packages/${NIMBUS}?tab=logs` } });
  });
});

describe("coreAppDown", () => {
  it("flags installed core packages that are not running", () => {
    const [f] = coreAppDown(snapshot({ packages: [pkg("ipfs.dnp.dappnode.eth", { isCore: true, state: "exited", running: false })] }));
    expect(f).toMatchObject({ severity: "critical", topic: "core", fix: { kind: "link", to: "/system" } });
  });
});

describe("setup pairing", () => {
  it("flags a consensus client without an execution client on the same network", () => {
    const [f] = consensusWithoutExecution(snapshot({ packages: [pkg(NIMBUS)] }));
    expect(f).toMatchObject({ id: "consensus-without-execution:mainnet", severity: "critical", topic: "setup", appId: NIMBUS });
    expect(f.fix).toMatchObject({ kind: "link", to: "/installer?category=ethstaking" });
  });
  it("is quiet when both halves are installed", () => {
    const s = snapshot({ packages: [pkg(NIMBUS), pkg(GETH)] });
    expect(consensusWithoutExecution(s)).toEqual([]);
    expect(executionWithoutConsensus(s)).toEqual([]);
  });
  it("warns about an execution client with no consensus client", () => {
    const [f] = executionWithoutConsensus(snapshot({ packages: [pkg(GETH)] }));
    expect(f).toMatchObject({ severity: "warning", topic: "setup" });
  });
  it("suggests monitoring when a consensus client runs without Prometheus", () => {
    expect(monitoringMissing(snapshot({ packages: [pkg(NIMBUS)] }))).toMatchObject({ id: "monitoring-missing", severity: "info", topic: "attestations" });
    expect(monitoringMissing(snapshot({ packages: [pkg(NIMBUS), pkg("prometheus.avado.dappnode.eth")] }))).toBeNull();
  });
});

describe("robustness", () => {
  it("rules tolerate manifest-less packages", () => {
    const s = snapshot({ packages: [{ name: "weird.public.dappnode.eth", state: "exited", running: false }] });
    for (const rule of [appStopped, appRestarting, coreAppDown, consensusWithoutExecution, executionWithoutConsensus, monitoringMissing])
      expect(() => rule(s)).not.toThrow();
    expect(appStopped(s)[0].title).toBe("weird is stopped");
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- src/health/__tests__/rules-apps-setup.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/health/rules/apps.js`**

```js
import { getClient, ROLES } from "health/clients";

const shortName = (name = "") => name.split(".")[0];
export const appTitle = pkg => (pkg && pkg.manifest && pkg.manifest.title) || shortName(pkg && pkg.name);
const isClient = pkg => {
  const c = getClient(pkg.name);
  return Boolean(c && (c.role === ROLES.EXECUTION || c.role === ROLES.CONSENSUS));
};
const logsLink = name => `/packages/${name}?tab=logs`;

export function appStopped({ packages }) {
  return (packages || [])
    .filter(p => p && !p.isCore && (p.state === "exited" || p.state === "dead" || p.state === "created"))
    .map(p => ({
      id: `app-stopped:${p.name}`,
      severity: isClient(p) ? "critical" : "warning",
      topic: "sync",
      appId: p.name,
      title: `${appTitle(p)} is stopped`,
      why: isClient(p)
        ? "While it is stopped it does not follow the chain, so your validators miss attestations and rewards."
        : "Anything that depends on it will not work until it runs again.",
      fix: { kind: "action", action: "startPackage", label: "Start it" },
      secondary: { kind: "link", to: logsLink(p.name), label: "See why in the logs" },
    }));
}

export function appRestarting({ packages }) {
  return (packages || [])
    .filter(p => p && p.state === "restarting")
    .map(p => ({
      id: `app-restarting:${p.name}`,
      severity: "critical",
      topic: "sync",
      appId: p.name,
      title: `${appTitle(p)} keeps restarting`,
      why: "It starts, fails and starts again. The reason is almost always in the last lines of its logs.",
      fix: { kind: "link", to: logsLink(p.name), label: "Open the logs" },
      steps: [
        "Open the logs and look at the last error before the restart.",
        "If it says the disk is full, free space in System → Storage.",
        "If it mentions a setting you changed, undo it in the app's Settings tab.",
        "Still restarting? Download the diagnostics report in Help and send it to support.",
      ],
    }));
}

export function coreAppDown({ packages }) {
  return (packages || [])
    .filter(p => p && p.isCore && p.running === false)
    .map(p => ({
      id: `core-app-down:${p.name}`,
      severity: "critical",
      topic: "core",
      appId: p.name,
      title: `System service ${appTitle(p)} is not running`,
      why: "Your AVADO needs its system services to install, update and reach apps.",
      fix: { kind: "link", to: "/system", label: "Open System" },
    }));
}
```

- [ ] **Step 5: Implement `src/health/rules/setup.js`**

```js
import { clientsByRole, ROLES, NETWORKS, PROMETHEUS_PACKAGE } from "health/clients";

const networksOf = list => new Set(list.map(({ client }) => client.network));

export function consensusWithoutExecution({ packages }) {
  const cc = clientsByRole(packages, ROLES.CONSENSUS);
  const ecNetworks = networksOf(clientsByRole(packages, ROLES.EXECUTION));
  const seen = new Set();
  return cc
    .filter(({ client }) => !ecNetworks.has(client.network))
    .filter(({ client }) => !seen.has(client.network) && seen.add(client.network))
    .map(({ pkg, client }) => ({
      id: `consensus-without-execution:${client.network}`,
      severity: "critical",
      topic: "setup",
      appId: pkg.name,
      title: `${client.label} has no execution client`,
      why: `A consensus client needs an execution client on ${NETWORKS[client.network]?.label || client.network} to follow the chain. Until you install one, it cannot attest and your validators miss rewards.`,
      fix: { kind: "link", to: "/installer?category=ethstaking", label: "Install an execution client" },
      learnMore: "https://docs.ava.do",
    }));
}

export function executionWithoutConsensus({ packages }) {
  const ec = clientsByRole(packages, ROLES.EXECUTION);
  const ccNetworks = networksOf(clientsByRole(packages, ROLES.CONSENSUS));
  return ec
    .filter(({ client }) => !ccNetworks.has(client.network))
    .map(({ pkg, client }) => ({
      id: `execution-without-consensus:${client.network}`,
      severity: "warning",
      topic: "setup",
      appId: pkg.name,
      title: `${client.label} has no consensus client`,
      why: "Since the Merge an execution client cannot follow the chain on its own. Install a consensus client for the same network.",
      fix: { kind: "link", to: "/installer?category=ethstaking", label: "Install a consensus client" },
    }));
}

export function monitoringMissing({ packages }) {
  const hasConsensus = clientsByRole(packages, ROLES.CONSENSUS).length > 0;
  const hasPrometheus = (packages || []).some(p => p && p.name === PROMETHEUS_PACKAGE);
  if (!hasConsensus || hasPrometheus) return null;
  return {
    id: "monitoring-missing",
    severity: "info",
    topic: "attestations",
    title: "Install monitoring to check missed attestations",
    why: "The monitoring package records your clients' metrics, so your AVADO can warn you about missed attestations, low peers or falling behind the chain.",
    fix: { kind: "link", to: "/installer/grafana.avado.dappnode.eth", label: "Install monitoring" },
    dismissable: true,
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/health/__tests__/rules-apps-setup.test.js`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add src/health/rules/apps.js src/health/rules/setup.js src/health/__tests__/fixtures.js src/health/__tests__/rules-apps-setup.test.js
git commit -m "feat(health): app state and client pairing rules"
```

---

### Task 6: Store service — shared fetch and update detection

**Files:**
- Create: `src/services/store/fetchStore.js`
- Create: `src/services/store/updates.js`
- Test: `src/services/store/__tests__/updates.test.js`
- Modify: `src/pages/installer/components/InstallerHome.jsx:~100-140` (use `fetchStore`)

**Interfaces:**
- Produces:
  - `fetchStore({ nodeid, packages }) → Promise<{ categories, packages: [{ manifest, manifesthash }] }>` (rejects on any failure). Also performs the IPFS `swarm/connect` calls that `InstallerHome` does today.
  - `computeUpdates(storePackages, installedPackages) → { [name]: { from, to, hash } }` using `semver.gt`; skips invalid versions.

- [ ] **Step 1: Write the failing test**

`src/services/store/__tests__/updates.test.js`:
```js
import { computeUpdates } from "services/store/updates";

const store = [
  { manifest: { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.49" }, manifesthash: "/ipfs/QmA" },
  { manifest: { name: "grafana.avado.dappnode.eth", version: "0.0.4" }, manifesthash: "/ipfs/QmB" },
  { manifest: { name: "broken.avado.dnp.dappnode.eth", version: "latest" } },
];

describe("computeUpdates", () => {
  it("lists installed packages with a newer store version", () => {
    const installed = [
      { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48" },
      { name: "grafana.avado.dappnode.eth", version: "0.0.4" },
      { name: "broken.avado.dnp.dappnode.eth", version: "1.0.0" },
      { name: "not-in-store.dnp.dappnode.eth", version: "1.0.0" },
    ];
    expect(computeUpdates(store, installed)).toEqual({
      "nimbus.avado.dnp.dappnode.eth": { from: "0.0.48", to: "0.0.49", hash: "/ipfs/QmA" },
    });
  });
  it("handles missing inputs", () => {
    expect(computeUpdates(undefined, undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/services/store`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/services/store/updates.js`**

```js
import semver from "semver";

export function computeUpdates(storePackages, installedPackages) {
  const out = {};
  const latest = {};
  for (const p of storePackages || []) {
    const m = p && p.manifest;
    if (m && m.name && semver.valid(m.version)) latest[m.name] = { version: m.version, hash: p.manifesthash };
  }
  for (const pkg of installedPackages || []) {
    const l = pkg && latest[pkg.name];
    if (l && semver.valid(pkg.version) && semver.gt(l.version, pkg.version))
      out[pkg.name] = { from: pkg.version, to: l.version, hash: l.hash };
  }
  return out;
}
```

- [ ] **Step 4: Implement `src/services/store/fetchStore.js`**

Move the logic from `InstallerHome.jsx` (the `store.getUpdates` JSON-RPC call, `peerConnect`, and the IPFS gateway fetch) into:
```js
import axios from "axios";
import JsonRpcClient from "react-jsonrpc-client";

const IPFS_GATEWAY = "http://ipfs.my.ava.do:8080/ipfs/";
const IPFS_API = "http://ipfs.my.ava.do:5001/api/v0/swarm/connect?arg=";

function peerConnect(peer) {
  axios.post(IPFS_API + peer).catch(e => console.log(`Failed to connect to ${peer}`, e.message));
}

/**
 * The DappStore catalogue for this box: rpc.ava.do decides which store
 * (production or staging) the node sees, the catalogue itself comes from IPFS.
 * Rejects when either step fails, e.g. when the box has no internet.
 */
export async function fetchStore({ nodeid, packages, storeHash }) {
  const api = new JsonRpcClient({ endpoint: "https://rpc.ava.do" });
  const response = await api.request("store.getUpdates", {
    nodeid,
    packages: (packages || []).map(p => ({ name: p.name, version: p.version })),
  });
  const storeRes = JSON.parse(response);
  (storeRes.ipfsHostNodes || []).forEach(peerConnect);
  const hash = storeHash || storeRes.hash;
  const res = await axios.get(IPFS_GATEWAY + hash, { timeout: 20000 });
  (res.data.ipfsHostNodes || []).forEach(peerConnect);
  return res.data;
}
```
Then in `InstallerHome.jsx`, replace the body of the `useEffect(() => { ... api.request("store.getUpdates" ...) }, [packages, dappnodeParams])` with:
```js
    useEffect(() => {
        if (!packages || !dappnodeParams || !dappnodeParams.nodeid) return;
        const storeHash = id && id !== "undefined" ? id : undefined;
        fetchStore({ nodeid: dappnodeParams.nodeid, packages, storeHash })
            .then(setStoreManifest)
            .catch(error => console.log(`Failed to fetch store: ${error.message}`));
    }, [packages, dappnodeParams]);
```
Add `import { fetchStore } from "services/store/fetchStore";` and delete the now-unused `peerConnect`, `JsonRpcClient` import and the commented-out `bo.ava.do` block.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- src/services/store && npm run build`
Expected: PASS (2 tests); build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/services/store src/pages/installer/components/InstallerHome.jsx
git commit -m "refactor(store): shared store fetch and update detection"
```

---

### Task 7: Rules — updates, access, storage, diagnoses

**Files:**
- Create: `src/health/rules/updates.js`
- Create: `src/health/rules/access.js`
- Create: `src/health/rules/storage.js`
- Create: `src/health/rules/core.js`
- Test: `src/health/__tests__/rules-updates-access-storage.test.js`

**Interfaces:**
- Consumes: `appTitle` (Task 5), `getClient`, `ROLES` (Task 3); snapshot fields `updates` (`{ [name]: {from,to,hash} } | null`), `sources.updates` (`"ok" | "failed" | "loading"`), `coreUpdate` (`{ available: boolean }`), `params`, `stats`, `diagnoses` (array of `{ id, ok, msg, solutions, loading }` from `pages/troubleshoot/selectors.getDiagnoses`).
- Produces: `updatesAvailable`, `coreUpdateAvailable`, `autoupdateOff`, `storeUnreachable` (updates.js); `portsClosed`, `noUpnp`, `noNatLoopback`, `remoteAccessMissing` (access.js); `diskHigh`, `parsePercent` (storage.js); `diagnoseFailed` (core.js).

- [ ] **Step 1: Write the failing tests**

`src/health/__tests__/rules-updates-access-storage.test.js`:
```js
import { updatesAvailable, coreUpdateAvailable, autoupdateOff, storeUnreachable } from "health/rules/updates";
import { portsClosed, noUpnp, noNatLoopback, remoteAccessMissing } from "health/rules/access";
import { diskHigh, parsePercent } from "health/rules/storage";
import { diagnoseFailed } from "health/rules/core";
import { pkg, snapshot } from "./fixtures";

describe("updates", () => {
  it("summarises available updates in one finding", () => {
    const f = updatesAvailable(snapshot({ updates: { a: { from: "1", to: "2" }, b: { from: "1", to: "3" } } }));
    expect(f).toMatchObject({ id: "updates-available", severity: "warning", title: "2 app updates are available", fix: { to: "/system/updates" } });
    expect(updatesAvailable(snapshot({ updates: { a: { from: "1", to: "2" } } })).title).toBe("1 app update is available");
    expect(updatesAvailable(snapshot({ updates: {} }))).toBeNull();
    expect(updatesAvailable(snapshot({ updates: null }))).toBeNull();
  });
  it("flags a core update", () => {
    expect(coreUpdateAvailable(snapshot({ coreUpdate: { available: true } }))).toMatchObject({ severity: "warning", fix: { to: "/system/updates" } });
    expect(coreUpdateAvailable(snapshot())).toBeNull();
  });
  it("notes clients with auto-update off", () => {
    const s = snapshot({ packages: [pkg("nimbus.avado.dnp.dappnode.eth", { autoupdate: false }), pkg("rotki.avado.dnp.dappnode.eth", { autoupdate: false })] });
    const out = autoupdateOff(s);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ severity: "info", appId: "nimbus.avado.dnp.dappnode.eth", dismissable: true });
  });
  it("updates-store-unreachable: explains a failed store fetch", () => {
    expect(storeUnreachable(snapshot({ sources: { updates: "failed" } }))).toMatchObject({ id: "store-unreachable", severity: "info" });
    expect(storeUnreachable(snapshot({ sources: { updates: "ok" } }))).toBeNull();
  });
});

describe("access", () => {
  it("maps params flags to findings", () => {
    expect(portsClosed(snapshot({ params: { alertToOpenPorts: true } }))).toMatchObject({ severity: "warning", topic: "access" });
    expect(portsClosed(snapshot({ params: {} }))).toBeNull();
    expect(noUpnp(snapshot({ params: { upnpAvailable: false } }))).toMatchObject({ severity: "info" });
    expect(noUpnp(snapshot({ params: {} }))).toBeNull();
    expect(noNatLoopback(snapshot({ params: { noNatLoopback: true, internalIp: "192.168.1.20" } })).why).toContain("192.168.1.20");
  });
  it("suggests remote access only when neither Remote Connect nor VPN is installed", () => {
    expect(remoteAccessMissing(snapshot())).toMatchObject({ severity: "info", dismissable: true });
    expect(remoteAccessMissing(snapshot({ packages: [pkg("remoteconnect.avado.dnp.dappnode.eth", { isCore: true })] }))).toBeNull();
  });
});

describe("storage", () => {
  it("disk-high parses percentages", () => {
    expect(parsePercent("12%")).toBe(12);
    expect(parsePercent(" 91 % ")).toBe(91);
    expect(parsePercent(87)).toBe(87);
    expect(parsePercent("")).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
    expect(parsePercent("n/a")).toBeNull();
  });
  it("warns at 80 %, is critical at 90 % and names the biggest apps", () => {
    const packages = [
      pkg("ethchain-geth.public.dappnode.eth", { volumes: [{ name: "data", size: 1.9e12 }] }),
      pkg("nimbus.avado.dnp.dappnode.eth", { volumes: [{ name: "data", size: 2e11 }] }),
    ];
    expect(diskHigh(snapshot({ stats: { disk: "79%" }, packages }))).toBeNull();
    expect(diskHigh(snapshot({ stats: { disk: "80%" }, packages })).severity).toBe("warning");
    const f = diskHigh(snapshot({ stats: { disk: "93%" }, packages }));
    expect(f.severity).toBe("critical");
    expect(f.why).toContain("ethchain-geth");
    expect(f.fix).toMatchObject({ kind: "link", to: "/system/storage" });
    expect(diskHigh(snapshot({ stats: {} }))).toBeNull();
  });
});

describe("diagnoses", () => {
  it("turns failing diagnoses into warnings, skipping disk and loading ones", () => {
    const diagnoses = [
      { id: "getDiagnoseIpfs", ok: false, msg: "IPFS is not resolving: timeout", solutions: ["Restart IPFS"] },
      { id: "getDiagnoseDiskSpace", ok: false, msg: "Disk usage is over 95%", solutions: [] },
      { id: "getDiagnoseDappmanagerConnected", loading: true, msg: "Checking" },
      { id: "getDiagnoseOpenPorts", ok: true, msg: "fine" },
    ];
    const out = diagnoseFailed(snapshot({ diagnoses }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "diagnose:getDiagnoseIpfs", severity: "warning", topic: "core", title: "IPFS is not resolving: timeout", steps: ["Restart IPFS"] });
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- src/health/__tests__/rules-updates-access-storage.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/health/rules/updates.js`**

```js
import { getClient, ROLES } from "health/clients";
import { appTitle } from "./apps";

export function updatesAvailable({ updates }) {
  const n = Object.keys(updates || {}).length;
  if (!n) return null;
  return {
    id: "updates-available",
    severity: "warning",
    topic: "updates",
    title: n === 1 ? "1 app update is available" : `${n} app updates are available`,
    why: "Updates fix bugs and keep your clients compatible with network upgrades. Clients that fall behind a hard fork stop following the chain.",
    fix: { kind: "link", to: "/system/updates", label: "Review updates" },
  };
}

export function coreUpdateAvailable({ coreUpdate }) {
  if (!coreUpdate || !coreUpdate.available) return null;
  return {
    id: "core-update-available",
    severity: "warning",
    topic: "updates",
    title: "An AVADO system update is available",
    why: "System updates improve how your AVADO installs, updates and monitors your apps.",
    fix: { kind: "link", to: "/system/updates", label: "Review the update" },
  };
}

export function autoupdateOff({ packages }) {
  return (packages || [])
    .filter(p => p && p.autoupdate === false)
    .filter(p => {
      const c = getClient(p.name);
      return c && (c.role === ROLES.EXECUTION || c.role === ROLES.CONSENSUS);
    })
    .map(p => ({
      id: `autoupdate-off:${p.name}`,
      severity: "info",
      topic: "updates",
      appId: p.name,
      title: `Automatic updates are off for ${appTitle(p)}`,
      why: "Clients need updates before network upgrades. With automatic updates off you have to install them yourself in time.",
      fix: { kind: "link", to: "/packages", label: "Turn on automatic updates" },
      dismissable: true,
    }));
}

export function storeUnreachable({ sources }) {
  if (!sources || sources.updates !== "failed") return null;
  return {
    id: "store-unreachable",
    severity: "info",
    topic: "updates",
    title: "Can't check for updates",
    why: "Your AVADO could not reach the AVADO store. Check that it is connected to the internet; your apps keep running meanwhile.",
    fix: { kind: "steps", label: "What to check" },
    steps: [
      "Check that the network cable is plugged in and your router has internet.",
      "Restart your router if other devices on your network are offline too.",
      "Reload this page. The check runs again every 10 minutes.",
    ],
  };
}
```

- [ ] **Step 4: Implement `src/health/rules/access.js`**

```js
export function portsClosed({ params }) {
  if (!params || !params.alertToOpenPorts) return null;
  return {
    id: "ports-closed",
    severity: "warning",
    topic: "access",
    title: "Your router is not forwarding the ports your clients need",
    why: "Without open peer-to-peer ports your clients find fewer peers, which makes them slower to follow the chain and can cost attestations.",
    fix: { kind: "steps", label: "How to open the ports" },
    steps: [
      "Turn on UPnP in your router's settings; your AVADO then opens the ports itself.",
      "If your router has no UPnP, forward the peer-to-peer ports shown on each client's Overview tab to your AVADO's internal IP.",
      "Come back here after a few minutes: this check refreshes on its own.",
    ],
  };
}

export function noUpnp({ params }) {
  if (!params || params.upnpAvailable !== false) return null;
  return {
    id: "no-upnp",
    severity: "info",
    topic: "access",
    title: "UPnP is not available on your router",
    why: "UPnP lets your AVADO open the ports it needs by itself. Without it you forward them by hand, once.",
    fix: { kind: "link", to: "/help/access", label: "Read how" },
    dismissable: true,
  };
}

export function noNatLoopback({ params }) {
  if (!params || !params.noNatLoopback) return null;
  return {
    id: "no-nat-loopback",
    severity: "info",
    topic: "access",
    title: "Use the internal address at home",
    why: `Your router does not route its public address back into your network. When you are at home, reach your AVADO at ${params.internalIp || "its internal IP"} or my.ava.do.`,
    fix: null,
    dismissable: true,
  };
}

export function remoteAccessMissing({ packages }) {
  const names = new Set((packages || []).map(p => p && p.name));
  if (names.has("remoteconnect.avado.dnp.dappnode.eth") || names.has("vpn.dnp.dappnode.eth")) return null;
  return {
    id: "remote-access-missing",
    severity: "info",
    topic: "access",
    title: "Set up remote access",
    why: "Remote Connect lets you check on your AVADO when you are away from home.",
    fix: { kind: "link", to: "/installer/remoteconnect.avado.dnp.dappnode.eth", label: "Install Remote Connect" },
    dismissable: true,
  };
}
```

- [ ] **Step 5: Implement `src/health/rules/storage.js`**

```js
import { appTitle } from "./apps";

export function parsePercent(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*%?/);
  return m ? Number(m[1]) : null;
}

export const appDiskUse = pkg =>
  ((pkg && pkg.volumes) || []).reduce((sum, v) => sum + (Number(v && v.size) || 0), 0);

export function diskHigh({ stats, packages }) {
  const pct = parsePercent(stats && stats.disk);
  if (pct === null || pct < 80) return null;
  const biggest = [...(packages || [])]
    .map(p => ({ p, size: appDiskUse(p) }))
    .filter(x => x.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 2)
    .map(x => appTitle(x.p));
  return {
    id: "disk-high",
    severity: pct >= 90 ? "critical" : "warning",
    topic: "storage",
    title: `Your disk is ${Math.round(pct)}% full`,
    why:
      (pct >= 90
        ? "When the disk is full your clients stop and your validators go offline. "
        : "Clients keep growing; plan some space now before it becomes urgent. ") +
      (biggest.length ? `Most space is used by ${biggest.join(" and ")}.` : ""),
    fix: { kind: "link", to: "/system/storage", label: "Free up space" },
  };
}
```

- [ ] **Step 6: Implement `src/health/rules/core.js`**

```js
const SKIP = new Set(["getDiagnoseDiskSpace", "getDiagnoseCoreDnpsRunning"]);

export function diagnoseFailed({ diagnoses }) {
  return (diagnoses || [])
    .filter(d => d && !d.loading && d.ok === false && !SKIP.has(d.id))
    .map(d => ({
      id: `diagnose:${d.id}`,
      severity: "warning",
      topic: "core",
      title: d.msg,
      why: "A built-in system check failed. The steps below usually fix it.",
      fix: { kind: "steps", label: "How to fix it" },
      steps: d.solutions || [],
    }));
}
```

- [ ] **Step 7: Run tests**

Run: `npm test -- src/health/__tests__/rules-updates-access-storage.test.js`
Expected: PASS (11 tests).

- [ ] **Step 8: Commit**

```bash
git add src/health/rules/updates.js src/health/rules/access.js src/health/rules/storage.js src/health/rules/core.js src/health/__tests__/rules-updates-access-storage.test.js
git commit -m "feat(health): update, access, disk and diagnose rules"
```

---

### Task 8: Prometheus metrics and chain rules

**Files:**
- Create: `src/health/prometheus.js`
- Create: `src/health/rules/chain.js`
- Test: `src/health/__tests__/prometheus.test.js`
- Test: `src/health/__tests__/rules-chain.test.js`

**Interfaces:**
- Consumes: `NETWORKS`, `currentSlot`, `clientsByRole`, `ROLES` (Task 3).
- Produces:
  - `PROMETHEUS_URL = "http://prometheus.my.ava.do:9090"`
  - `QUERIES = { headSlot, peers, attesterMiss, attesterHit }` (PromQL strings)
  - `fetchMetrics(fetchImpl = fetch) → Promise<Metrics | null>` where `Metrics = { headSlot: Sample[], peers: Sample[], attesterMiss: Sample[], attesterHit: Sample[] }`, `Sample = { client, network, value: number }`. Returns `null` if any request fails or Prometheus returns `status !== "success"`.
  - Rules `chainSyncing`, `headBehind`, `lowPeers`, `missedAttestations`.

- [ ] **Step 1: Write the failing Prometheus test**

`src/health/__tests__/prometheus.test.js`:
```js
import { fetchMetrics, QUERIES } from "health/prometheus";

const ok = result => ({ ok: true, json: async () => ({ status: "success", data: { resultType: "vector", result } }) });
const sample = (client, network, value) => ({ metric: { client, network, job: client }, value: [1790103551, String(value)] });

describe("fetchMetrics", () => {
  it("queries every metric and normalises samples", async () => {
    const fetchImpl = vi.fn(async url => {
      if (url.includes(encodeURIComponent(QUERIES.headSlot))) return ok([sample("nimbus", "mainnet", 15273292)]);
      if (url.includes(encodeURIComponent(QUERIES.peers))) return ok([sample("nimbus", "mainnet", 16)]);
      return ok([]);
    });
    const m = await fetchMetrics(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(m.headSlot).toEqual([{ client: "nimbus", network: "mainnet", value: 15273292 }]);
    expect(m.peers[0].value).toBe(16);
    expect(m.attesterMiss).toEqual([]);
  });

  it("fetchMetrics returns null on failure", async () => {
    expect(await fetchMetrics(async () => { throw TypeError("Failed to fetch"); })).toBeNull();
    expect(await fetchMetrics(async () => ({ ok: false, json: async () => ({}) }))).toBeNull();
    expect(await fetchMetrics(async () => ({ ok: true, json: async () => ({ status: "error", error: "bad" }) }))).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing chain rules test**

`src/health/__tests__/rules-chain.test.js`:
```js
import { chainSyncing, headBehind, lowPeers, missedAttestations } from "health/rules/chain";
import { pkg, snapshot } from "./fixtures";

const NIMBUS = pkg("nimbus.avado.dnp.dappnode.eth", { manifest: { title: "Nimbus Consensus Client" } });
const now = 1790103551 * 1000; // wall-clock mainnet slot 15 273 294

const metrics = (overrides = {}) => ({ headSlot: [], peers: [], attesterMiss: [], attesterHit: [], ...overrides });

describe("chain rules", () => {
  it("reports syncing chains from chainData", () => {
    const f = chainSyncing(snapshot({ chainData: [{ name: "Nimbus", syncing: true, progress: 0.42, message: "Syncing 42%" }] }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ severity: "info", topic: "sync", title: "Nimbus is syncing (42%)" });
  });

  it("flags a head more than two epochs behind the wall clock", () => {
    const behind = snapshot({ now, packages: [NIMBUS], metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273294 - 65 }] }) });
    expect(headBehind(behind)[0]).toMatchObject({ severity: "warning", appId: "nimbus.avado.dnp.dappnode.eth" });
    const fine = snapshot({ now, packages: [NIMBUS], metrics: metrics({ headSlot: [{ client: "nimbus", network: "mainnet", value: 15273292 }] }) });
    expect(headBehind(fine)).toEqual([]);
    expect(headBehind(snapshot({ packages: [NIMBUS], metrics: null }))).toEqual([]);
  });

  it("flags fewer than 10 peers", () => {
    const s = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 4 }] }) });
    expect(lowPeers(s)[0]).toMatchObject({ severity: "warning", title: "Nimbus Consensus Client has only 4 peers" });
    const ok = snapshot({ packages: [NIMBUS], metrics: metrics({ peers: [{ client: "nimbus", network: "mainnet", value: 16 }] }) });
    expect(lowPeers(ok)).toEqual([]);
  });

  it("flags missed attestations, critical above half missed", () => {
    const some = snapshot({ packages: [NIMBUS], metrics: metrics({
      attesterMiss: [{ client: "nimbus", network: "mainnet", value: 2 }],
      attesterHit: [{ client: "nimbus", network: "mainnet", value: 18 }],
    }) });
    expect(missedAttestations(some)[0]).toMatchObject({ severity: "warning", topic: "attestations", title: "2 attestations missed in the last hour" });
    const most = snapshot({ packages: [NIMBUS], metrics: metrics({
      attesterMiss: [{ client: "nimbus", network: "mainnet", value: 12 }],
      attesterHit: [{ client: "nimbus", network: "mainnet", value: 3 }],
    }) });
    expect(missedAttestations(most)[0].severity).toBe("critical");
    const none = snapshot({ packages: [NIMBUS], metrics: metrics({ attesterMiss: [{ client: "nimbus", network: "mainnet", value: 0 }] }) });
    expect(missedAttestations(none)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- src/health/__tests__/prometheus.test.js src/health/__tests__/rules-chain.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/health/prometheus.js`**

```js
// Client metrics from the monitoring package. Prometheus answers the Admin's
// origin with Access-Control-Allow-Origin (verified on the test box), so the
// browser can query it directly. Labels `client` and `network` are set by the
// AVADO Prometheus scrape config.
export const PROMETHEUS_URL = "http://prometheus.my.ava.do:9090";

export const QUERIES = {
  headSlot: "max by (client, network) (beacon_head_slot)",
  peers: 'max by (client, network) (libp2p_peers or p2p_peer_count{state="Connected"})',
  attesterMiss:
    "sum by (client, network) (increase(validator_monitor_prev_epoch_on_chain_attester_miss_total[1h]))",
  attesterHit:
    "sum by (client, network) (increase(validator_monitor_prev_epoch_on_chain_attester_hit_total[1h]))",
};

async function query(q, fetchImpl) {
  const res = await fetchImpl(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw Error(`Prometheus HTTP error`);
  const body = await res.json();
  if (body.status !== "success") throw Error(body.error || "Prometheus query failed");
  return body.data.result.map(({ metric, value }) => ({
    client: metric.client,
    network: metric.network,
    value: Number(value[1]),
  }));
}

export async function fetchMetrics(fetchImpl = fetch) {
  try {
    const entries = await Promise.all(
      Object.entries(QUERIES).map(async ([key, q]) => [key, await query(q, fetchImpl)])
    );
    return Object.fromEntries(entries);
  } catch (e) {
    console.log(`Prometheus unavailable: ${e.message}`);
    return null;
  }
}
```

- [ ] **Step 5: Implement `src/health/rules/chain.js`**

```js
import { clientsByRole, currentSlot, NETWORKS, ROLES } from "health/clients";
import { appTitle } from "./apps";

/** Installed consensus client packages matched to a metric sample. */
function matchSamples(packages, samples) {
  const cc = clientsByRole(packages, ROLES.CONSENSUS);
  return (samples || [])
    .map(s => ({ s, match: cc.find(({ client }) => client.promClient === s.client && client.network === s.network) }))
    .filter(x => x.match);
}

export function chainSyncing({ chainData }) {
  return (chainData || [])
    .filter(c => c && c.syncing)
    .map(c => {
      const pct = typeof c.progress === "number" ? ` (${Math.floor(c.progress * 100)}%)` : "";
      return {
        id: `chain-syncing:${c.name}`,
        severity: "info",
        topic: "sync",
        title: `${c.name} is syncing${pct}`,
        why: "Your client is catching up with the chain. Validators can only attest once it is synced.",
        fix: null,
      };
    });
}

export function headBehind({ packages, metrics, now }) {
  if (!metrics) return [];
  return matchSamples(packages, metrics.headSlot)
    .map(({ s, match }) => {
      const wall = currentSlot(s.network, now);
      const n = NETWORKS[s.network];
      if (wall === null || wall - s.value <= 2 * n.slotsPerEpoch) return null;
      return {
        id: `head-behind:${match.pkg.name}`,
        severity: "warning",
        topic: "sync",
        appId: match.pkg.name,
        title: `${appTitle(match.pkg)} is ${wall - s.value} slots behind the chain`,
        why: "It is not keeping up with the network, so your validators may miss attestations.",
        fix: { kind: "steps", label: "What to check" },
        steps: [
          "Check that your execution client is running and synced.",
          "Check the peer count: fewer than 10 peers makes a client fall behind.",
          "Restart the client; if it falls behind again, open its logs.",
        ],
      };
    })
    .filter(Boolean);
}

export function lowPeers({ packages, metrics }) {
  if (!metrics) return [];
  return matchSamples(packages, metrics.peers)
    .filter(({ s }) => s.value < 10)
    .map(({ s, match }) => ({
      id: `low-peers:${match.pkg.name}`,
      severity: "warning",
      topic: "sync",
      appId: match.pkg.name,
      title: `${appTitle(match.pkg)} has only ${s.value} peers`,
      why: "With few peers your client hears about new blocks late and can fall behind or miss attestations.",
      fix: { kind: "link", to: "/help/access", label: "Improve connectivity" },
    }));
}

export function missedAttestations({ packages, metrics }) {
  if (!metrics) return [];
  return matchSamples(packages, metrics.attesterMiss)
    .filter(({ s }) => s.value >= 1)
    .map(({ s, match }) => {
      const hit = (metrics.attesterHit || []).find(h => h.client === s.client && h.network === s.network);
      const total = s.value + ((hit && hit.value) || 0);
      const missed = Math.round(s.value);
      return {
        id: `missed-attestations:${match.pkg.name}`,
        severity: total > 0 && s.value / total > 0.5 ? "critical" : "warning",
        topic: "attestations",
        appId: match.pkg.name,
        title: `${missed} attestation${missed === 1 ? "" : "s"} missed in the last hour`,
        why: "Each missed attestation costs a small reward. A few are normal; a steady stream means something needs fixing.",
        fix: { kind: "link", to: "/help/attestations", label: "Find the cause" },
      };
    });
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/health/__tests__/prometheus.test.js src/health/__tests__/rules-chain.test.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Verify the queries against the test box**

Run:
```bash
SSHPASS=avado sshpass -e ssh avado@10.10.10.2 'docker exec DAppNodeCore-dappmanager.dnp.dappnode.eth sh -c "curl -sG http://prometheus.my.ava.do:9090/api/v1/query --data-urlencode \"query=max by (client, network) (libp2p_peers or p2p_peer_count{state=\\\"Connected\\\"})\""'
```
Expected: `"status":"success"` with a `nimbus` / `mainnet` sample. Fix the PromQL string if not; the attester queries legitimately return an empty result on a box without validators.

- [ ] **Step 8: Commit**

```bash
git add src/health/prometheus.js src/health/rules/chain.js src/health/__tests__/prometheus.test.js src/health/__tests__/rules-chain.test.js
git commit -m "feat(health): Prometheus metrics with sync, peers and attestation rules"
```

---

### Task 9: HealthProvider, useHealth, dismissals and fix actions

**Files:**
- Create: `src/health/rules/index.js`
- Create: `src/health/dismissals.js`
- Create: `src/health/fixActions.js`
- Create: `src/health/HealthProvider.jsx`
- Test: `src/health/__tests__/HealthProvider.test.jsx`
- Modify: `src/App.jsx` (wrap the open-session layout in `<HealthProvider>`)

**Interfaces:**
- Consumes: all rules (Tasks 5, 7, 8), `runChecks`, `verdictOf` (Task 4), `fetchStore`, `computeUpdates` (Task 6), `fetchMetrics` (Task 8), `PROMETHEUS_PACKAGE` (Task 3); redux selectors `getDnpInstalled`, `getDappnodeStats`, `getDappnodeParams`, `getChainData`, `getCoreUpdateAvailable`, `getDiagnoses`.
- Produces:
  - `ALL_RULES` array (rules/index.js).
  - `isDismissed(id)`, `dismiss(id)`, `undismissAll()` (localStorage key `avado.dismissedFindings`, wrapped in try/catch).
  - `runFixAction(finding, dispatch)` — handles `fix.action` `"startPackage"` (dispatch `togglePackage(appId)`), `"restartPackage"` (dispatch `restartPackage(appId)`).
  - `<HealthProvider fetchStoreImpl? fetchMetricsImpl?>` and `useHealth() → { findings, allFindings, verdict, checkedAt, sources, updates, storePackages, refresh, dismiss }`. `findings` excludes dismissed info findings; `allFindings` includes them.

- [ ] **Step 1: Create `src/health/rules/index.js`**

```js
import { appStopped, appRestarting, coreAppDown } from "./apps";
import { consensusWithoutExecution, executionWithoutConsensus, monitoringMissing } from "./setup";
import { updatesAvailable, coreUpdateAvailable, autoupdateOff, storeUnreachable } from "./updates";
import { portsClosed, noUpnp, noNatLoopback, remoteAccessMissing } from "./access";
import { diskHigh } from "./storage";
import { diagnoseFailed } from "./core";
import { chainSyncing, headBehind, lowPeers, missedAttestations } from "./chain";

export const ALL_RULES = [
  appStopped, appRestarting, coreAppDown,
  consensusWithoutExecution, executionWithoutConsensus, monitoringMissing,
  updatesAvailable, coreUpdateAvailable, autoupdateOff, storeUnreachable,
  portsClosed, noUpnp, noNatLoopback, remoteAccessMissing,
  diskHigh, diagnoseFailed,
  chainSyncing, headBehind, lowPeers, missedAttestations,
];
```

- [ ] **Step 2: Create `src/health/dismissals.js`**

```js
const KEY = "avado.dismissedFindings";

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}
function write(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch (e) {
    // Private mode or blocked storage: dismissals last until reload.
  }
}
export const isDismissed = id => read().has(id);
export function dismiss(id) {
  const s = read();
  s.add(id);
  write(s);
}
export const undismissAll = () => write(new Set());
```

- [ ] **Step 3: Create `src/health/fixActions.js`**

```js
import { togglePackage, restartPackage } from "pages/packages/actions";

export function runFixAction(finding, dispatch) {
  const { fix, appId } = finding || {};
  if (!fix || fix.kind !== "action" || !appId) return;
  if (fix.action === "startPackage") dispatch(togglePackage(appId));
  else if (fix.action === "restartPackage") dispatch(restartPackage(appId));
}
```

- [ ] **Step 4: Write the failing provider test**

`src/health/__tests__/HealthProvider.test.jsx`:
```jsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { HealthProvider, useHealth } from "health/HealthProvider";

vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: s => s.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({ getDappnodeStats: s => s.stats, getDappnodeParams: s => s.params }));
vi.mock("services/chainData/selectors", () => ({ getChainData: () => [] }));
vi.mock("services/coreUpdate/selectors", () => ({ getCoreUpdateAvailable: () => false }));
vi.mock("pages/troubleshoot/selectors", () => ({ getDiagnoses: () => [] }));

const state = {
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48", state: "running", running: true, manifest: { title: "Nimbus" } }],
  stats: { disk: "12%" },
  params: { nodeid: "0xabc" },
};

function Probe() {
  const { verdict, findings, sources } = useHealth();
  return (
    <div>
      <span data-testid="verdict">{verdict.label}</span>
      <span data-testid="ids">{findings.map(f => f.id).join(",")}</span>
      <span data-testid="updates">{sources.updates}</span>
    </div>
  );
}

const renderWith = props =>
  render(
    <Provider store={createStore(() => state)}>
      <HealthProvider {...props}>
        <Probe />
      </HealthProvider>
    </Provider>
  );

describe("HealthProvider", () => {
  it("combines redux state, store updates and metrics into findings", async () => {
    renderWith({
      fetchStoreImpl: async () => ({ packages: [{ manifest: { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.49" } }] }),
      fetchMetricsImpl: async () => null,
    });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("ok"));
    expect(screen.getByTestId("verdict").textContent).toBe("Action required");
    expect(screen.getByTestId("ids").textContent).toContain("consensus-without-execution:mainnet");
    expect(screen.getByTestId("ids").textContent).toContain("updates-available");
  });

  it("useHealth store failure: marks updates failed and still renders", async () => {
    renderWith({ fetchStoreImpl: async () => { throw Error("offline"); }, fetchMetricsImpl: async () => null });
    await waitFor(() => expect(screen.getByTestId("updates").textContent).toBe("failed"));
    expect(screen.getByTestId("ids").textContent).toContain("store-unreachable");
  });
});
```

- [ ] **Step 5: Run to see it fail**

Run: `npm test -- src/health/__tests__/HealthProvider.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `src/health/HealthProvider.jsx`**

```jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappnodeStats, getDappnodeParams } from "services/dappnodeStatus/selectors";
import { getChainData } from "services/chainData/selectors";
import { getCoreUpdateAvailable } from "services/coreUpdate/selectors";
import { getDiagnoses } from "pages/troubleshoot/selectors";
import { fetchStore } from "services/store/fetchStore";
import { computeUpdates } from "services/store/updates";
import { fetchMetrics } from "./prometheus";
import { PROMETHEUS_PACKAGE } from "./clients";
import { runChecks, verdictOf } from "./engine";
import { ALL_RULES } from "./rules";
import { isDismissed, dismiss as persistDismiss } from "./dismissals";

const STORE_INTERVAL = 10 * 60 * 1000;
const METRICS_INTERVAL = 60 * 1000;

const HealthContext = createContext(null);

export function HealthProvider({ children, fetchStoreImpl = fetchStore, fetchMetricsImpl = fetchMetrics }) {
  const packages = useSelector(getDnpInstalled) || [];
  const stats = useSelector(getDappnodeStats) || {};
  const params = useSelector(getDappnodeParams) || {};
  const chainData = useSelector(getChainData) || [];
  const coreAvailable = useSelector(getCoreUpdateAvailable);
  const diagnoses = useSelector(getDiagnoses) || [];

  const [store, setStore] = useState({ status: "loading", packages: null });
  const [metrics, setMetrics] = useState({ status: "not-installed", data: null });
  const [tick, setTick] = useState(0);
  const [dismissVersion, setDismissVersion] = useState(0);

  const packageKey = packages.map(p => `${p.name}@${p.version}`).join("|");
  const prometheusRunning = packages.some(p => p.name === PROMETHEUS_PACKAGE && p.running);

  // Store catalogue (updates). Re-run when installed versions change.
  useEffect(() => {
    if (!params.nodeid) return;
    let cancelled = false;
    const load = () =>
      fetchStoreImpl({ nodeid: params.nodeid, packages })
        .then(s => !cancelled && setStore({ status: "ok", packages: s.packages || [] }))
        .catch(() => !cancelled && setStore(prev => ({ status: "failed", packages: prev.packages })));
    load();
    const t = setInterval(load, STORE_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [params.nodeid, packageKey, tick]);

  // Prometheus metrics, only when the monitoring package runs.
  useEffect(() => {
    if (!prometheusRunning) {
      setMetrics({ status: "not-installed", data: null });
      return;
    }
    let cancelled = false;
    const load = () =>
      fetchMetricsImpl().then(
        data => !cancelled && setMetrics({ status: data ? "ok" : "failed", data })
      );
    load();
    const t = setInterval(load, METRICS_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [prometheusRunning, tick]);

  const updates = useMemo(
    () => (store.packages ? computeUpdates(store.packages, packages) : null),
    [store.packages, packageKey]
  );

  const value = useMemo(() => {
    const snapshot = {
      packages,
      stats,
      params,
      diagnoses,
      chainData,
      updates,
      coreUpdate: { available: Boolean(coreAvailable) },
      metrics: metrics.data,
      sources: { updates: store.status, metrics: metrics.status },
      now: Date.now(),
    };
    const allFindings = runChecks(snapshot, ALL_RULES);
    const findings = allFindings.filter(f => !(f.dismissable && isDismissed(f.id)));
    return {
      findings,
      allFindings,
      verdict: verdictOf(findings),
      checkedAt: new Date(snapshot.now),
      sources: snapshot.sources,
      updates: updates || {},
      storePackages: store.packages,
      refresh: () => setTick(t => t + 1),
      dismiss: id => {
        persistDismiss(id);
        setDismissVersion(v => v + 1);
      },
    };
  }, [packages, stats, params, diagnoses, chainData, updates, coreAvailable, metrics, store, dismissVersion]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw Error("useHealth must be used inside <HealthProvider>");
  return ctx;
}
```

- [ ] **Step 7: Run the test**

Run: `npm test -- src/health/__tests__/HealthProvider.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Mount the provider in `src/App.jsx`**

Add `import { HealthProvider } from "health/HealthProvider";`. Wrap the `isOpen` branch's `<div className="body">…</div>` in `<HealthProvider>…</HealthProvider>`.

- [ ] **Step 9: Run all tests and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/health src/App.jsx
git commit -m "feat(health): HealthProvider with store updates, metrics and dismissals"
```

---

### Task 10: Shared UI — StatusPill, AppAvatar, AppCard, Tabs, FindingRow

**Files:**
- Create: `src/components/appStatus.js`
- Create: `src/components/ui/StatusPill.jsx`
- Create: `src/components/ui/AppAvatar.jsx`
- Create: `src/components/ui/Tabs.jsx`
- Create: `src/components/health/FindingRow.jsx`
- Create: `src/components/apps/AppCard.jsx`
- Modify: `src/components/ui/index.js` (export StatusPill, AppAvatar, Tabs)
- Test: `src/components/__tests__/appStatus.test.js`
- Test: `src/components/__tests__/ui.test.jsx`

**Interfaces:**
- Consumes: `useHealth` (Task 9), `runFixAction` (Task 9), `appTitle` (Task 5).
- Produces:
  - `appStatus(pkg, { findings, updates }) → { key, label, tone }` with keys `running | stopped | crashed | restarting | paused | needs-setup | update | unknown`; tones `success | neutral | danger | warning | accent`.
  - `<StatusPill status={{label, tone}} />`
  - `<AppAvatar pkg size={40} />` — IPFS avatar unless the hash is a known placeholder or the image fails, then a monogram tile.
  - `<Tabs tabs={[{id,label,badge?}]} active onChange />` (ARIA tablist, arrow-key navigation).
  - `<FindingRow finding compact? />` (icon by severity, title, why toggle, fix button, steps list, dismiss for dismissable).
  - `<AppCard pkg />` (avatar, full title, description, status pill, Open / Manage).
  - `appDescription(pkg)`: `manifest.shortDescription` or the first sentence of `manifest.description`, max 90 chars.

- [ ] **Step 1: Write the failing status test**

`src/components/__tests__/appStatus.test.js`:
```js
import { appStatus, appDescription } from "components/appStatus";

const p = (state, extra = {}) => ({ name: "nimbus.avado.dnp.dappnode.eth", state, running: state === "running", ...extra });

describe("appStatus", () => {
  it("maps docker states", () => {
    expect(appStatus(p("running"), {}).key).toBe("running");
    expect(appStatus(p("exited"), {}).key).toBe("stopped");
    expect(appStatus(p("dead"), {}).key).toBe("crashed");
    expect(appStatus(p("restarting"), {}).key).toBe("restarting");
    expect(appStatus(p("paused"), {}).key).toBe("paused");
    expect(appStatus(p("weird"), {}).key).toBe("unknown");
  });
  it("prefers needs-setup, then update, over running", () => {
    const findings = [{ appId: "nimbus.avado.dnp.dappnode.eth", topic: "setup", severity: "critical" }];
    expect(appStatus(p("running"), { findings }).key).toBe("needs-setup");
    expect(appStatus(p("running"), { updates: { "nimbus.avado.dnp.dappnode.eth": { to: "2" } } })).toMatchObject({ key: "update", label: "Update available" });
  });
});

describe("appDescription", () => {
  it("uses shortDescription, else the first sentence of description", () => {
    expect(appDescription({ manifest: { shortDescription: "Beacon chain and validator" } })).toBe("Beacon chain and validator");
    expect(appDescription({ manifest: { description: "Grafana dashboards for your AVADO. Installing it also installs Prometheus." } })).toBe("Grafana dashboards for your AVADO.");
    expect(appDescription({})).toBe("");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/components/__tests__/appStatus.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/appStatus.js`**

```js
const STATES = {
  running: { key: "running", label: "Running", tone: "success" },
  exited: { key: "stopped", label: "Stopped", tone: "neutral" },
  created: { key: "stopped", label: "Stopped", tone: "neutral" },
  dead: { key: "crashed", label: "Crashed", tone: "danger" },
  restarting: { key: "restarting", label: "Restarting", tone: "warning" },
  paused: { key: "paused", label: "Paused", tone: "neutral" },
};

export function appStatus(pkg, { findings = [], updates = {} } = {}) {
  if (!pkg) return { key: "unknown", label: "Unknown", tone: "neutral" };
  const base = STATES[pkg.state] || { key: "unknown", label: pkg.state || "Unknown", tone: "neutral" };
  if (base.key !== "running") return base;
  if (findings.some(f => f.appId === pkg.name && f.topic === "setup" && f.severity !== "info"))
    return { key: "needs-setup", label: "Needs setup", tone: "warning" };
  if (updates[pkg.name]) return { key: "update", label: "Update available", tone: "accent" };
  return base;
}

export function appDescription(pkg) {
  const m = (pkg && pkg.manifest) || {};
  const text = (m.shortDescription || (m.description || "").split(/(?<=\.)\s/)[0] || "").trim();
  return text.length > 90 ? text.slice(0, 87).trimEnd() + "…" : text;
}
```

- [ ] **Step 4: Write the failing UI test**

`src/components/__tests__/ui.test.jsx`:
```jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusPill from "components/ui/StatusPill";
import AppAvatar, { PLACEHOLDER_AVATARS } from "components/ui/AppAvatar";
import Tabs from "components/ui/Tabs";

describe("StatusPill", () => {
  it("renders the label with the tone", () => {
    render(<StatusPill status={{ label: "Running", tone: "success" }} />);
    expect(screen.getByText("Running")).toHaveAttribute("data-tone", "success");
  });
});

describe("AppAvatar fallback", () => {
  it("renders a monogram for placeholder avatars and missing manifests", () => {
    const { rerender } = render(<AppAvatar pkg={{ name: "node-exporter.avado.dappnode.eth", manifest: { title: "Node Exporter", avatar: PLACEHOLDER_AVATARS[0] } }} />);
    expect(screen.getByText("NE")).toBeInTheDocument();
    rerender(<AppAvatar pkg={{ name: "custom.public.dappnode.eth" }} />);
    expect(screen.getByText("CU")).toBeInTheDocument();
  });
  it("falls back to the monogram when the image fails", () => {
    const { container } = render(<AppAvatar pkg={{ name: "x.dnp.dappnode.eth", manifest: { title: "Xylo App", avatar: "/ipfs/QmReal" } }} />);
    fireEvent.error(container.querySelector("img"));
    expect(screen.getByText("XA")).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  it("marks the active tab and moves with arrow keys", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "logs", label: "Logs" }]} active="overview" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("logs");
  });
});
```

- [ ] **Step 5: Implement `src/components/ui/StatusPill.jsx`**

```jsx
import React from "react";
import { cn } from "./cn";

const TONES = {
  success: "text-success bg-success/10 border-success/25",
  warning: "text-warning bg-warning/12 border-warning/25",
  danger: "text-danger bg-danger/10 border-danger/25",
  accent: "text-accent bg-accent/10 border-accent/25",
  neutral: "text-fg-muted bg-fg/[0.05] border-border",
};
const DOTS = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", accent: "bg-accent", neutral: "bg-fg-subtle" };

export default function StatusPill({ status, className }) {
  const tone = (status && status.tone) || "neutral";
  return (
    <span
      data-tone={tone}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5", TONES[tone], className)}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />
      {status && status.label}
    </span>
  );
}
```

- [ ] **Step 6: Implement `src/components/ui/AppAvatar.jsx`**

```jsx
import React, { useState } from "react";
import { cn } from "./cn";
import { getClient } from "health/clients";

// The generic AVADO logo that many package manifests ship as their avatar.
export const PLACEHOLDER_AVATARS = ["/ipfs/QmYRmFCtdXvqq3drc6kBXxeWiiMatTfKVpVrmLX883cQbR"];

const ROLE_TINT = {
  execution: "bg-accent/15 text-accent",
  consensus: "bg-brand/15 text-brand",
  monitoring: "bg-warning/15 text-warning",
  mev: "bg-success/15 text-success",
  remote: "bg-fg/10 text-fg",
};

const monogram = pkg => {
  const title = (pkg && pkg.manifest && pkg.manifest.title) || ((pkg && pkg.name) || "?").split(".")[0];
  const words = title.replace(/[-_]/g, " ").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : title.slice(0, 2);
  return letters.toUpperCase();
};

export default function AppAvatar({ pkg, size = 40, className }) {
  const [failed, setFailed] = useState(false);
  const avatar = pkg && pkg.manifest && pkg.manifest.avatar;
  const usable = avatar && !PLACEHOLDER_AVATARS.includes(avatar) && !failed;
  const style = { width: size, height: size };
  if (usable)
    return (
      <img
        src={`http://ipfs.my.ava.do:8080/ipfs/${avatar.replace("/ipfs/", "")}`}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={cn("flex-shrink-0 rounded-[10px] border border-border bg-white object-cover", className)}
      />
    );
  const client = getClient(pkg && pkg.name);
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-[10px] font-display text-sm font-bold",
        ROLE_TINT[client && client.role] || "bg-fg/10 text-fg-muted",
        className
      )}
    >
      {monogram(pkg)}
    </span>
  );
}
```

- [ ] **Step 7: Implement `src/components/ui/Tabs.jsx`**

```jsx
import React from "react";
import { cn } from "./cn";

export default function Tabs({ tabs, active, onChange, className }) {
  const onKeyDown = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    onChange(tabs[(i + d + tabs.length) % tabs.length].id);
  };
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:shadow-focus",
              selected ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {t.label}
            {t.badge ? <span className="rounded-full bg-warning/15 px-1.5 text-xs text-warning">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: Implement `src/components/health/FindingRow.jsx`**

```jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import Button from "components/ui/Button";
import { cn } from "components/ui/cn";
import { runFixAction } from "health/fixActions";
import { useHealth } from "health/HealthProvider";

const ICON = {
  critical: { glyph: "M18 6 6 18M6 6l12 12", cls: "bg-danger/15 text-danger", label: "Action required" },
  warning: { glyph: "M12 8v5M12 16.5h.01", cls: "bg-warning/15 text-warning", label: "Needs attention" },
  info: { glyph: "M12 11v5M12 7.5h.01", cls: "bg-accent/15 text-accent", label: "Tip" },
};

export default function FindingRow({ finding, compact = false }) {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const { dismiss } = useHealth();
  const icon = ICON[finding.severity] || ICON.info;
  const { fix } = finding;

  const fixButton =
    fix && fix.kind === "link" ? (
      <Button as={Link} to={fix.to} size="sm" variant={finding.severity === "info" ? "secondary" : "primary"}>
        {fix.label}
      </Button>
    ) : fix && fix.kind === "action" ? (
      <Button size="sm" onClick={() => runFixAction(finding, dispatch)}>{fix.label}</Button>
    ) : fix && fix.kind === "steps" ? (
      <Button size="sm" variant="secondary" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {fix.label}
      </Button>
    ) : null;

  return (
    <li className="flex gap-3 py-3.5">
      <span className={cn("mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full", icon.cls)}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d={icon.glyph} />
        </svg>
        <span className="sr-only">{icon.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-0 break-words font-medium text-fg">{finding.title}</p>
            {!compact && finding.why && (
              <button type="button" onClick={() => setOpen(o => !o)} className="mt-0.5 text-left text-sm text-fg-muted hover:text-fg" aria-expanded={open}>
                {open ? finding.why : "Why this matters"}
              </button>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {fixButton}
            {finding.secondary && (
              <Button as={Link} to={finding.secondary.to} size="sm" variant="ghost">{finding.secondary.label}</Button>
            )}
            {finding.dismissable && (
              <Button size="sm" variant="ghost" onClick={() => dismiss(finding.id)}>Hide</Button>
            )}
          </div>
        </div>
        {open && finding.steps && finding.steps.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
            {finding.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
      </div>
    </li>
  );
}
```
Before using `Button as={Link}`, read `src/components/ui/Button.jsx`: if it does not forward an `as` prop, add `as: Tag = "button"` to its props, render `<Tag>` instead of `<button>`, and pass `type` only when `Tag === "button"`.

- [ ] **Step 9: Implement `src/components/apps/AppCard.jsx`**

```jsx
import React from "react";
import { Link } from "react-router-dom";
import AppAvatar from "components/ui/AppAvatar";
import StatusPill from "components/ui/StatusPill";
import { appStatus, appDescription } from "components/appStatus";
import { appTitle } from "health/rules/apps";
import { useHealth } from "health/HealthProvider";

export function openUrl(pkg) {
  const w = pkg.manifest && pkg.manifest.ui && pkg.manifest.ui.OnboardingWizard;
  return w && w.external && w.url ? w.url : null;
}

export default function AppCard({ pkg }) {
  const { findings, updates } = useHealth();
  const status = appStatus(pkg, { findings, updates });
  const external = openUrl(pkg);
  const page = `/packages/${pkg.name}`;
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <AppAvatar pkg={pkg} />
        <div className="min-w-0 flex-1">
          <h3 className="mb-0 break-words font-display text-base font-semibold leading-snug text-fg">{appTitle(pkg)}</h3>
          <p className="mb-0 mt-0.5 break-words text-sm text-fg-muted">{appDescription(pkg)}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={status} />
        <div className="flex gap-3 text-sm font-medium">
          {external ? (
            <a href={external} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Open</a>
          ) : (
            <Link to={`${page}?tab=setup`} className="text-accent hover:underline">Open</Link>
          )}
          <Link to={page} className="text-fg-muted hover:text-fg">Manage</Link>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 10: Export and run tests**

Add to `src/components/ui/index.js`:
```js
export { default as StatusPill } from "./StatusPill";
export { default as AppAvatar } from "./AppAvatar";
export { default as Tabs } from "./Tabs";
```
Run: `npm test -- src/components`
Expected: PASS (7 tests).

- [ ] **Step 11: Commit**

```bash
git add src/components
git commit -m "feat(ui): status pill, app avatar with monograms, tabs, finding row, app card"
```

---

### Task 11: Navigation, routes, redirects, 404 and top bar labels

**Files:**
- Modify: `src/components/navbar/navbarItems.js`
- Modify: `src/App.jsx` (Switch + redirects + NotFound)
- Create: `src/components/NotFound.jsx`
- Modify: `src/pages/index.js` (remove `home`; add `help`, `staking` once Tasks 15–16 land — add them there, not here)
- Delete: `src/pages/home/` (dead redirect page)
- Modify: `src/pages/troubleshoot/data.js` (`rootPath = "/help"`, `title = "Help"`)
- Modify: `src/components/navbar/TopBar.jsx` and `src/components/navbar/topbar.css` (visible labels ≥1024 px, `aria-label` + `title` everywhere)
- Modify: `src/pages/dashboard/components/Dashboard.jsx:51` and `src/pages/packages/components/PackageList.jsx:156` (`/Packages/` → `/packages/`)
- Test: `src/components/__tests__/routes.test.jsx`

**Interfaces:**
- Produces: routes `/help` (was `/troubleshoot`), `/staking` (added in Task 16), `/system/updates|storage|history` (Task 18). Redirects: `/` → `/dashboard`, `/troubleshoot` and `/support` → `/help`, `/Packages/:rest*` → `/packages/:rest*`, `/System/:rest*` → `/system/:rest*`, `/activity` → `/system/history`. Unknown path → `<NotFound />`.
- `export const REDIRECTS = [{ from, to }]` in `src/App.jsx` for the test.

- [ ] **Step 1: Write the failing routes test**

`src/components/__tests__/routes.test.jsx`:
```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { AppRoutes } from "../../AppRoutes";

const pages = {
  dashboard: { rootPath: "/dashboard", RootComponent: () => <p>home page</p> },
  help: { rootPath: "/help", RootComponent: () => <p>help page</p> },
  packages: { rootPath: "/packages", RootComponent: () => <Route path="/packages/:id" render={({ match }) => <p>app {match.params.id}</p>} /> },
  system: { rootPath: "/system", RootComponent: () => <p>system page</p> },
};

const at = path => render(<MemoryRouter initialEntries={[path]}><AppRoutes pages={pages} /></MemoryRouter>);

describe("routes", () => {
  it.each([
    ["/", "home page"],
    ["/troubleshoot", "help page"],
    ["/support", "help page"],
    ["/Packages/nimbus.avado.dnp.dappnode.eth", "app nimbus.avado.dnp.dappnode.eth"],
    ["/activity", "system page"],
  ])("%s lands on %s", (path, text) => {
    at(path);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows a not-found page for unknown paths", () => {
    at("/nope");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/components/__tests__/routes.test.jsx`
Expected: FAIL — `AppRoutes` not found.

- [ ] **Step 3: Create `src/components/NotFound.jsx`**

```jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-fg">Page not found</h1>
      <p className="mt-2 text-fg-muted">This address doesn't match a page in your AVADO.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/dashboard" className="font-medium text-accent hover:underline">Go to Home</Link>
        <Link to="/help" className="font-medium text-accent hover:underline">Get help</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/AppRoutes.jsx` and use it from `App.jsx`**

```jsx
import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import ErrorBoundary from "components/generic/ErrorBoundary";
import NotFound from "components/NotFound";

export const REDIRECTS = [
  { from: "/", to: "/dashboard", exact: true },
  { from: "/troubleshoot", to: "/help" },
  { from: "/support", to: "/help" },
  { from: "/activity", to: "/system/history" },
];

export function AppRoutes({ pages }) {
  return (
    <Switch>
      {REDIRECTS.map(r => <Redirect key={r.from} exact={r.exact} from={r.from} to={r.to} />)}
      <Route path="/Packages/:rest+" render={({ match, location }) => <Redirect to={`/packages/${match.params.rest}${location.search}`} />} />
      <Route path="/System/:rest+" render={({ match }) => <Redirect to={`/system/${match.params.rest}`} />} />
      {Object.values(pages).map(({ RootComponent, rootPath }) => (
        <Route
          key={rootPath}
          path={rootPath}
          render={props => (
            <ErrorBoundary>
              <RootComponent {...props} />
            </ErrorBoundary>
          )}
        />
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}
```
In `App.jsx`, replace the `{Object.values(pages).map(...)}` block with `<AppRoutes pages={pages} />` and import it. Remove the `home` entry from `src/pages/index.js` and delete `src/pages/home/`.

- [ ] **Step 5: Point Support at `/help`**

In `src/pages/troubleshoot/data.js` set `export const rootPath = "/help";` and `export const title = "Help";`. In `navbarItems.js` rename the item to `{ name: "Help", href: "/help", icon: Activity }`, change the Remote Connect `href` to `/packages/remoteconnect.avado.dnp.dappnode.eth`, and change `/Packages/` to `/packages/` in `Dashboard.jsx` and `PackageList.jsx`. Grep for leftovers:
```bash
grep -rn '"/Packages\|`/Packages\|"/System\|`/System\|/troubleshoot' src --include=*.js --include=*.jsx
```
Expected: only `AppRoutes.jsx` matches.

- [ ] **Step 6: Label the top bar**

In `TopBar.jsx`, give each icon control an `aria-label` and `title` and a text label span `<span className="topbar-label">Theme</span>` (Theme, Chain, Notifications, Help). In `topbar.css` add:
```css
.topbar-label { display: none; margin-left: 0.4rem; font-size: 0.8125rem; font-weight: 500; }
@media (min-width: 1024px) { .topbar-label { display: inline; } }
```
Read each dropdown component (`dropdownMenus/*`) first; put the label inside the existing toggle button, not beside it.

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build`
Expected: routes test PASS (6 tests); build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat(nav): Help route, redirects for old paths, not-found page, labelled top bar"
```

---

### Task 12: Home — verdict panel, resources strip, chain line, app grid

**Files:**
- Create: `src/pages/dashboard/components/VerdictPanel.jsx`
- Create: `src/pages/dashboard/components/ResourcesStrip.jsx`
- Create: `src/pages/dashboard/components/ChainLine.jsx`
- Modify: `src/pages/dashboard/components/Dashboard.jsx` (rewrite presentation, keep the 5 s stats polling)
- Delete: `src/pages/dashboard/components/StatsCard.jsx`, `ChainCard.jsx`, `VolumeCard.jsx` (after confirming no other imports with grep)
- Test: `src/pages/dashboard/__tests__/VerdictPanel.test.jsx`

**Interfaces:**
- Consumes: `useHealth` (Task 9), `FindingRow`, `AppCard` (Task 10), `parsePercent` (Task 7), redux `getDappnodeStats`, `getChainData`, `getFilteredPackages`, `getConnectionStatus`.
- Produces: `<VerdictPanel findings verdict checkedAt onRefresh limit={5} />`, `verdictSentence(verdict, findings)`.

- [ ] **Step 1: Write the failing verdict test**

`src/pages/dashboard/__tests__/VerdictPanel.test.jsx`:
```jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { verdictSentence, VerdictView } from "pages/dashboard/components/VerdictPanel";

vi.mock("components/health/FindingRow", () => ({ default: ({ finding }) => <li>{finding.title}</li> }));

const f = (id, severity) => ({ id, severity, topic: "sync", title: `title ${id}` });

describe("verdictSentence", () => {
  it("uses the worst finding's title, or the healthy sentence", () => {
    expect(verdictSentence({ level: "critical" }, [f("a", "critical")])).toBe("title a");
    expect(verdictSentence({ level: "ok" }, [])).toBe("All good. Your AVADO is healthy.");
  });
});

describe("VerdictView", () => {
  it("shows at most 5 findings with a show-all toggle", () => {
    const findings = ["a", "b", "c", "d", "e", "f", "g"].map(id => f(id, "warning"));
    render(<MemoryRouter><VerdictView verdict={{ level: "warning", label: "Needs attention" }} findings={findings} checkedAt={new Date(0)} onRefresh={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByText("title f")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all 7" }));
    expect(screen.getByText("title g")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/pages/dashboard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `VerdictPanel.jsx`**

```jsx
import React, { useState } from "react";
import { cn } from "components/ui/cn";
import FindingRow from "components/health/FindingRow";
import { useHealth } from "health/HealthProvider";

const BAND = {
  critical: { bg: "bg-verdict-crit", dot: "bg-danger", ring: "ring-danger/30" },
  warning: { bg: "bg-verdict-warn", dot: "bg-warning", ring: "ring-warning/30" },
  ok: { bg: "bg-verdict-ok", dot: "bg-brand", ring: "ring-brand/30" },
};

export function verdictSentence(verdict, findings) {
  if (verdict.level === "ok") return "All good. Your AVADO is healthy.";
  return findings[0] ? findings[0].title : verdict.label;
}

export function VerdictView({ verdict, findings, checkedAt, onRefresh, limit = 5 }) {
  const [all, setAll] = useState(false);
  const band = BAND[verdict.level] || BAND.ok;
  const shown = all ? findings : findings.slice(0, limit);
  return (
    <section aria-labelledby="verdict-title" className={cn("rounded-lg border border-border p-5 sm:p-6", band.bg)}>
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full ring-4", band.dot, band.ring, verdict.level !== "ok" && "motion-safe:animate-pulse-once")} />
        {verdict.label}
      </p>
      <h2 id="verdict-title" className="mb-0 break-words font-display text-2xl font-bold leading-tight text-fg sm:text-[2.5rem]">
        {verdictSentence(verdict, findings)}
      </h2>
      {shown.length > 0 && <ul className="mt-4 divide-y divide-border/70 pl-0">{shown.map(f => <FindingRow key={f.id} finding={f} />)}</ul>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
        {findings.length > limit ? (
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => setAll(a => !a)}>
            {all ? "Show fewer" : `Show all ${findings.length}`}
          </button>
        ) : <span />}
        <button type="button" onClick={onRefresh} className="hover:text-fg">
          Checked {checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Check again
        </button>
      </div>
    </section>
  );
}

export default function VerdictPanel() {
  const { verdict, findings, checkedAt, refresh } = useHealth();
  return <VerdictView verdict={verdict} findings={findings} checkedAt={checkedAt} onRefresh={refresh} />;
}
```
Add to `tailwind.config.js` `keyframes`/`animation`: `'pulse-once': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } }` and `animation: { 'pulse-once': 'pulse-once 1.2s ease-out 2' }`.

- [ ] **Step 4: Implement `ResourcesStrip.jsx` and `ChainLine.jsx`**

```jsx
// ResourcesStrip.jsx
import React from "react";
import { Link } from "react-router-dom";
import { parsePercent } from "health/rules/storage";
import { cn } from "components/ui/cn";

const Meter = ({ label, pct, detail }) => {
  const tone = pct >= 90 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand";
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="tabular-nums text-fg-muted">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct || 0, 100)}%` }} />
      </div>
      {detail && <p className="mb-0 mt-1 truncate text-xs text-fg-subtle">{detail}</p>}
    </div>
  );
};

export default function ResourcesStrip({ stats = {} }) {
  return (
    <section aria-label="Resources" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:gap-6">
      <Meter label="CPU" pct={parsePercent(stats.cpu)} detail={stats.cpuName} />
      <Meter label="Memory" pct={parsePercent(stats.memory)} detail={stats.memUsed && `${stats.memUsed} of ${stats.memTotal}`} />
      <Meter label="Disk" pct={parsePercent(stats.disk)} detail={stats.diskUsed && `${stats.diskUsed} of ${stats.diskTotal}`} />
      <Link to="/system/storage" className="self-start text-sm font-medium text-accent hover:underline sm:self-center">Storage</Link>
    </section>
  );
}
```
```jsx
// ChainLine.jsx
import React from "react";

export default function ChainLine({ chainData = [] }) {
  if (!chainData.length) return null;
  return (
    <ul className="flex flex-col gap-1 pl-0 text-sm">
      {chainData.map(c => (
        <li key={c.name} className="flex flex-wrap items-center gap-2 text-fg-muted">
          <span className={c.syncing ? "h-2 w-2 rounded-full bg-warning" : "h-2 w-2 rounded-full bg-success"} aria-hidden="true" />
          <span className="font-medium text-fg">{c.name}</span>
          <span>{c.syncing ? c.message || "Syncing" : "Synced"}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Rewrite `Dashboard.jsx`**

Keep the `useEffect` that polls `fetchDappnodeStats` every 5 s and the `connect` wiring. Replace the returned JSX with:
```jsx
    <div className="animate-fade-in flex flex-col gap-6">
      <PageHeader title="Home" subtitle="Whether your AVADO is healthy, and what runs on it.">
        <Badge variant={connection.isOpen ? "success" : "danger"} dot>{connection.isOpen ? "Connected" : "Disconnected"}</Badge>
      </PageHeader>
      <VerdictPanel />
      <ResourcesStrip stats={dappnodeStats} />
      <ChainLine chainData={chainData} />
      <section aria-labelledby="apps-title">
        <SectionHeader title={<span id="apps-title">Your apps</span>} count={activePackages.length}
          action={<Button variant="ghost" size="sm" onClick={() => history.push("/installer")}>DappStore</Button>} />
        {activePackages.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="mb-1 font-display text-lg font-semibold text-fg">Your AVADO is ready</p>
            <p className="mb-4 text-sm text-fg-muted">Start with Staking setup, or browse the DappStore for other apps.</p>
            <div className="flex justify-center gap-2">
              <Button size="sm" onClick={() => history.push("/staking")}>Staking setup</Button>
              <Button size="sm" variant="secondary" onClick={() => history.push("/installer")}>DappStore</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activePackages.map(p => <AppCard key={p.name} pkg={p} />)}
          </div>
        )}
      </section>
    </div>
```
Add `connection: getConnectionStatus` to `mapStateToProps`, drop `dappnodeVolumes`, and import `VerdictPanel`, `ResourcesStrip`, `ChainLine`, `AppCard`. Then delete `StatsCard.jsx`, `ChainCard.jsx` and `VolumeCard.jsx` if `grep -rn "StatsCard\|ChainCard\|VolumeCard" src` finds no other users.

- [ ] **Step 6: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 7: Verify in the browser against the test box**

Run `npm start` (Vite on http://localhost:3000; the Admin connects to the box's WAMP at `wamp.my.ava.do` over ZeroTier). With Claude in Chrome open http://localhost:3000/#/dashboard at 1440×900, 768×1024 and 360×780, in dark and light themes. Expected on the test box: verdict "Action required", sentence "Nimbus has no execution client", an "Install an execution client" button, Nimbus card status "Needs setup", Grafana/Prometheus/Node exporter cards with full titles and distinct monograms, no horizontal scroll at 360 px.

- [ ] **Step 8: Commit**

```bash
git add -A src tailwind.config.js
git commit -m "feat(home): health verdict, resources strip and app cards"
```

---

### Task 13: App page with tabs (replaces PackageWizard and PackageInterface for My DApps)

**Files:**
- Create: `src/pages/packages/components/AppPage.jsx`
- Create: `src/pages/packages/components/AppOverview.jsx`
- Create: `src/pages/packages/components/SetupFrame.jsx`
- Modify: `src/pages/packages/components/PackagesRoot.jsx`
- Modify: `src/pages/packages/components/PackageViews/Details/index.jsx` (section title "Stats" → "Details"; add volume sizes)
- Delete: `src/pages/packages/components/PackageWizard.jsx` (after grep shows no other importers)
- Test: `src/pages/packages/__tests__/AppPage.test.jsx`

**Interfaces:**
- Consumes: `useHealth`, `FindingRow`, `StatusPill`, `AppAvatar`, `Tabs`, `appStatus`, `appDescription`, `appTitle`, `appDiskUse` (Task 7), existing `Controls`, `Details`, `Envs`, `FileManager`, `Logs`, `s.getDnp`, `useTheme`.
- Produces: `/packages/:id?tab=overview|setup|logs|settings|files`; `wizardUrl(pkg, theme) → string | null` (links.OnboardingWizard, or Remote Connect's themed URL); `/packages/:id/detail` redirects to `/packages/:id?tab=overview`.

- [ ] **Step 1: Write the failing test**

`src/pages/packages/__tests__/AppPage.test.jsx`:
```jsx
import { wizardUrl, tabsFor } from "pages/packages/components/AppPage";

describe("app page helpers", () => {
  it("finds the wizard URL", () => {
    expect(wizardUrl({ name: "nimbus.avado.dnp.dappnode.eth", manifest: { links: { OnboardingWizard: "http://nimbus.my.ava.do" } } }, "dark")).toBe("http://nimbus.my.ava.do");
    expect(wizardUrl({ name: "remoteconnect.avado.dnp.dappnode.eth", manifest: {} }, "light")).toBe("http://remoteconnect.my.ava.do/?theme=light");
    expect(wizardUrl({ name: "x", manifest: {} }, "dark")).toBeNull();
  });
  it("only offers Setup when there is a wizard, and defaults to it", () => {
    expect(tabsFor(true).map(t => t.id)).toEqual(["setup", "overview", "logs", "settings", "files"]);
    expect(tabsFor(false).map(t => t.id)).toEqual(["overview", "logs", "settings", "files"]);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/pages/packages`
Expected: FAIL.

- [ ] **Step 3: Implement `SetupFrame.jsx`**

```jsx
import React from "react";

export default function SetupFrame({ url, title }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm text-fg-muted">
        <span className="truncate">Setup provided by {title}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 font-medium text-accent hover:underline">Open in new tab</a>
      </div>
      <iframe title={`${title} setup`} src={url} className="block h-[75vh] w-full border-0 bg-white" />
    </div>
  );
}
```

- [ ] **Step 4: Implement `AppOverview.jsx`**

```jsx
import React from "react";
import FindingRow from "components/health/FindingRow";
import { useHealth } from "health/HealthProvider";
import Controls from "./PackageViews/Controls";
import Details from "./PackageViews/Details";

export default function AppOverview({ dnp, isCore }) {
  const { allFindings } = useHealth();
  const mine = allFindings.filter(f => f.appId === dnp.name);
  return (
    <div className="flex flex-col gap-4">
      {mine.length > 0 && (
        <section className="rounded-lg border border-border bg-surface px-4">
          <ul className="divide-y divide-border pl-0">{mine.map(f => <FindingRow key={f.id} finding={f} />)}</ul>
        </section>
      )}
      <Controls dnp={dnp} showReset={!isCore} showRemove={!isCore} showResync={false} />
      <Details dnp={dnp} />
    </div>
  );
}
```

- [ ] **Step 5: Implement `AppPage.jsx`**

```jsx
import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import * as s from "../selectors";
import { useTheme } from "theme/ThemeProvider";
import { useHealth } from "health/HealthProvider";
import { appStatus, appDescription } from "components/appStatus";
import { appTitle } from "health/rules/apps";
import AppAvatar from "components/ui/AppAvatar";
import StatusPill from "components/ui/StatusPill";
import Tabs from "components/ui/Tabs";
import AppOverview from "./AppOverview";
import SetupFrame from "./SetupFrame";
import Envs from "./PackageViews/Envs";
import FileManager from "./PackageViews/FileManager";
import Logs from "./PackageViews/Logs";
import NoDnpInstalled from "./NoDnpInstalled";
import { LoadingState } from "./PackagePresentation";
import { getIsLoading } from "services/loadingStatus/selectors";

export function wizardUrl(pkg, theme) {
  if (pkg && pkg.name === "remoteconnect.avado.dnp.dappnode.eth") return `http://remoteconnect.my.ava.do/?theme=${theme}`;
  const link = pkg && pkg.manifest && pkg.manifest.links && pkg.manifest.links.OnboardingWizard;
  return link || null;
}

export function tabsFor(hasSetup) {
  return [
    ...(hasSetup ? [{ id: "setup", label: "Setup" }] : []),
    { id: "overview", label: "Overview" },
    { id: "logs", label: "Logs" },
    { id: "settings", label: "Settings" },
    { id: "files", label: "Files" },
  ];
}

function AppPage({ dnp, id, loading, history, location, isCore = false }) {
  const { theme } = useTheme();
  const { findings, updates } = useHealth();
  if (!dnp) return loading ? <LoadingState label="Loading app…" /> : <NoDnpInstalled id={id} moduleName="packages" />;

  const url = wizardUrl(dnp, theme);
  const tabs = tabsFor(Boolean(url));
  const requested = new URLSearchParams(location.search).get("tab");
  const active = tabs.some(t => t.id === requested) ? requested : tabs[0].id;
  const ownFindings = findings.filter(f => f.appId === dnp.name && f.severity !== "info").length;
  const shownTabs = tabs.map(t => (t.id === "overview" && ownFindings ? { ...t, badge: ownFindings } : t));
  const setTab = tab => history.replace({ pathname: location.pathname, search: `?tab=${tab}` });

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AppAvatar pkg={dnp} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="mb-0 break-words font-display text-2xl font-bold text-fg">{appTitle(dnp)}</h1>
          <p className="mb-0 text-sm text-fg-muted">{appDescription(dnp)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={appStatus(dnp, { findings, updates })} />
          <span className="font-mono text-xs text-fg-subtle">v{dnp.version}</span>
        </div>
      </header>
      <Tabs tabs={shownTabs} active={active} onChange={setTab} />
      {active === "setup" && url && <SetupFrame url={url} title={appTitle(dnp)} />}
      {active === "overview" && <AppOverview dnp={dnp} isCore={isCore} />}
      {active === "logs" && <Logs id={dnp.name} />}
      {active === "settings" && <Envs dnp={dnp} />}
      {active === "files" && <FileManager dnp={dnp} />}
    </div>
  );
}

export default connect(
  createStructuredSelector({ dnp: s.getDnp, id: s.getUrlId, loading: getIsLoading.dnpInstalled })
)(AppPage);
```

- [ ] **Step 6: Route it**

`PackagesRoot.jsx`:
```jsx
import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import { rootPath } from "../data";
import PackagesHome from "./PackagesHome";
import AppPage from "./AppPage";

const PackagesRoot = () => (
  <Switch>
    <Route exact path={rootPath} component={PackagesHome} />
    <Route exact path={rootPath + "/:id/detail"} render={({ match }) => <Redirect to={`${rootPath}/${match.params.id}?tab=overview`} />} />
    <Route exact path={rootPath + "/:id"} component={AppPage} />
  </Switch>
);

export default PackagesRoot;
```
In `SystemRoot.jsx` replace the `PackageInterface` route with `<Route path={rootPath + "/:id"} render={props => <AppPage {...props} isCore />} />`, importing `AppPage` from `pages/packages/components/AppPage`, but only after Task 18 adds its own sub-routes (`updates`, `storage`, `history`) above it. Delete `PackageWizard.jsx` and, if unused, `PackageInterface.jsx`.

- [ ] **Step 7: Details section title and volume sizes**

In `PackageViews/Details/index.jsx` rename the "Stats" heading to "Details", and in its volumes list show `prettyBytes(volume.size)` when `size` is present. Use the existing byte formatter under `utils/` if there is one (`grep -rn "Bytes" src/utils`); otherwise add `src/utils/prettyBytes.js`:
```js
export default function prettyBytes(n) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
```

- [ ] **Step 8: Run tests, build, browser-check**

Run: `npm test && npm run build`. Then with the dev server open `/#/packages/nimbus.avado.dnp.dappnode.eth` (defaults to Setup with the dark-framed wizard), `?tab=overview` (the Nimbus pairing finding sits at the top), and Logs, Settings, Files; and `/#/packages/grafana.avado.dappnode.eth` (no Setup tab). Check 360 px: the tabs scroll horizontally inside their own bar; the page does not.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "feat(apps): one app page with Setup, Overview, Logs, Settings and Files tabs"
```

---

### Task 14: My DApps list — rows, correct auto-update, no redux mutation

**Files:**
- Modify: `src/pages/packages/components/PackageList.jsx`
- Test: `src/pages/packages/__tests__/PackageList.test.jsx`

**Interfaces:**
- Consumes: `AppAvatar`, `StatusPill`, `appStatus`, `appTitle`, `useHealth`, `setAutoUpdate`, `restartPackage`, `confirmRestartPackage`.
- Produces: `getAutoUpdateState(dnp) → boolean` exported and reading `dnp.autoupdate` (default `true` when undefined, matching today's behaviour for packages without the flag). Read the current implementation first and keep its default.

- [ ] **Step 1: Write the failing test**

```jsx
import { getAutoUpdateState } from "pages/packages/components/PackageList";

describe("getAutoUpdateState", () => {
  it("reads the package's own flag, not the manifest's", () => {
    expect(getAutoUpdateState({ autoupdate: false, manifest: { autoupdate: true } })).toBe(false);
    expect(getAutoUpdateState({ autoupdate: true, manifest: { autoupdate: false } })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/pages/packages/__tests__/PackageList.test.jsx`
Expected: FAIL (the function is not exported, or it reads `manifest`).

- [ ] **Step 3: Rewrite `PackageList.jsx` presentation**

- Export `getAutoUpdateState(dnp)` reading `dnp.autoupdate`, and call it with `dnp` (the bug was passing `manifest`).
- Remove the per-mount `bo.ava.do` / IPFS store refetch and the `p.title = …` mutation; titles come from `appTitle(dnp)`.
- Render one `section` panel with a `ul` of rows. Each row: `AppAvatar` (32 px), title (`break-words`) + `appDescription`, `StatusPill`, a text link "Open" (external or `?tab=setup`), "Manage" (`/packages/:name`), a Restart icon button with `aria-label="Restart {title}"` and the existing confirm, and the auto-update switch labelled "Auto-update" (visually hidden below 640 px, `aria-label` always).
- Below 640 px rows stack: identity line, then status + actions line.
- Keep `PackageList`'s props interface (`moduleName`, `coreDnps`), since System's core list uses it.

- [ ] **Step 4: Run tests, build, browser-check**

Run: `npm test && npm run build`. Open `/#/packages` and `/#/system` at 360 and 1440 px. Toggle Grafana's auto-update off and on and confirm the switch reflects the real state after the WAMP push.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(apps): readable app list; auto-update switch reads the package flag"
```

---

### Task 15: Help — topics, guided pages, diagnostics report

**Files:**
- Create: `src/health/report.js`
- Test: `src/health/__tests__/report.test.js`
- Create: `src/pages/troubleshoot/topics.js`
- Create: `src/pages/troubleshoot/components/HelpHome.jsx`
- Create: `src/pages/troubleshoot/components/HelpTopic.jsx`
- Create: `src/pages/troubleshoot/components/ReportPanel.jsx`
- Modify: `src/pages/troubleshoot/components/TroubleshootRoot.jsx` (routes `/help` → HelpHome, `/help/:topic` → HelpTopic)
- Delete: `src/pages/troubleshoot/components/TroubleshootHome.jsx`, `TroubleshootPresentation.jsx` (after grep)

**Interfaces:**
- Consumes: `useHealth` (allFindings, verdict, sources), redux `getDnpInstalled`, `getDappnodeStats`, `getDappnodeParams`, `getChainData`, `getUserActionLogs`, `getDappmanagerVersionData`; `window.versionData` (Admin version); `appDiskUse`, `appTitle`.
- Produces:
  - `buildReport({ verdict, findings, packages, stats, params, chainData, userActionLogs, versions, now }) → string`
  - `mailtoReport(report, verdict, findings) → string` (≤ 1800 chars)
  - `TOPICS: [{ id: "setup"|"sync"|"attestations"|"updates"|"access"|"storage", title, when, findingTopics, steps: [{ title, body, action? }] }]`

- [ ] **Step 1: Write the failing report test**

```js
import { buildReport, mailtoReport } from "health/report";

const input = {
  verdict: { level: "critical", label: "Action required" },
  findings: [{ id: "consensus-without-execution:mainnet", severity: "critical", topic: "setup", title: "Nimbus has no execution client" }],
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48", state: "running", isCore: false,
    envs: { GF_SECURITY_ADMIN_PASSWORD: "hunter2", FEE_RECIPIENT: "0xabc" },
    volumes: [{ size: 2e11 }], manifest: { title: "Nimbus" } }],
  stats: { cpu: "4%", memory: "10%", disk: "12%", diskTotal: "3.6 TB" },
  params: { internalIp: "192.168.1.20", ip: "85.84.83.82", nodeid: "0xNODE", name: "My AVADO" },
  chainData: [{ name: "Nimbus", syncing: false, message: "Synced" }],
  userActionLogs: [{ event: "restartPackage.dappmanager.dnp.dappnode.eth", level: "info", message: "Restarted", timestamp: "2026-09-22T10:00:00Z", kwargs: { id: "x", privateKey: "0xSECRET" } }],
  versions: { admin: "10.0.52", dappmanager: "10.0.47" },
  now: new Date("2026-09-22T12:00:00Z"),
};

describe("buildReport", () => {
  const r = buildReport(input);
  it("contains the verdict, findings, versions and apps", () => {
    expect(r).toContain("Action required");
    expect(r).toContain("[critical] Nimbus has no execution client");
    expect(r).toContain("admin 10.0.52");
    expect(r).toContain("Nimbus (nimbus.avado.dnp.dappnode.eth) 0.0.48 running");
    expect(r).toContain("192.168.1.20");
    expect(r).toContain("0xNODE");
  });
  it("never leaks env values, public IPs or log arguments", () => {
    expect(r).not.toContain("hunter2");
    expect(r).not.toContain("0xabc");
    expect(r).not.toContain("85.84.83.82");
    expect(r).not.toContain("0xSECRET");
  });
  it("keeps the mailto link short", () => {
    const url = mailtoReport(r, input.verdict, input.findings);
    expect(url.startsWith("mailto:ziga@ava.do?subject=")).toBe(true);
    expect(url.length).toBeLessThanOrEqual(1800);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/health/__tests__/report.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `src/health/report.js`**

```js
import { appTitle } from "./rules/apps";
import { appDiskUse } from "./rules/storage";

const gb = n => (n ? `${(n / 1e9).toFixed(1)} GB` : "?");

/** Plain-text support report. Deliberately excludes env values, logs, keys and public IPs. */
export function buildReport({ verdict, findings, packages, stats, params, chainData, userActionLogs, versions, now }) {
  const lines = [];
  lines.push("AVADO diagnostics report", `Created ${now.toISOString()}`, "");
  lines.push(`Health: ${verdict.label}`);
  for (const f of findings) lines.push(`- [${f.severity}] ${f.title}`);
  if (!findings.length) lines.push("- no findings");
  lines.push("", "Versions");
  for (const [k, v] of Object.entries(versions || {})) lines.push(`- ${k} ${v || "?"}`);
  lines.push("", "Box");
  lines.push(`- node id ${params.nodeid || "?"}`, `- internal IP ${params.internalIp || "?"}`);
  lines.push(`- CPU ${stats.cpu || "?"}, memory ${stats.memory || "?"}, disk ${stats.disk || "?"} of ${stats.diskTotal || "?"}`);
  lines.push("", "Apps");
  for (const p of packages || [])
    lines.push(`- ${appTitle(p)} (${p.name}) ${p.version || "?"} ${p.state || "?"}${p.isCore ? " [system]" : ""}, disk ${gb(appDiskUse(p))}`);
  lines.push("", "Chains");
  for (const c of chainData || []) lines.push(`- ${c.name}: ${c.syncing ? c.message || "syncing" : "synced"}`);
  lines.push("", "Recent activity");
  for (const l of (userActionLogs || []).slice(0, 20))
    lines.push(`- ${l.timestamp} ${l.level} ${String(l.event || "").split(".")[0]}: ${String(l.message || "").slice(0, 160)}`);
  return lines.join("\n");
}

export function mailtoReport(report, verdict, findings) {
  const subject = `AVADO support: ${verdict.label}`;
  const summary = [
    "Hi AVADO support,",
    "",
    "(Describe what you were doing and what went wrong.)",
    "",
    `Health: ${verdict.label}`,
    ...findings.slice(0, 8).map(f => `- [${f.severity}] ${f.title}`),
    "",
    "The full diagnostics report is attached (Help > Download report).",
  ].join("\n");
  let body = summary;
  let url = `mailto:ziga@ava.do?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  while (url.length > 1800 && body.length > 200) {
    body = body.slice(0, body.length - 100);
    url = `mailto:ziga@ava.do?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return url;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/health/__tests__/report.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/pages/troubleshoot/topics.js`**

Six topics. Every step is plain text; `action` is an optional `{ label, to }` link. Content:
```js
export const TOPICS = [
  {
    id: "setup", title: "Validator setup", when: "Choosing clients, importing keys, fee recipient.",
    findingTopics: ["setup"],
    steps: [
      { title: "Install an execution client and a consensus client", body: "Your validator needs both, on the same network. Staking setup checks which ones you have.", action: { label: "Open Staking setup", to: "/staking" } },
      { title: "Import your validator keys", body: "Open your consensus client's Setup tab and use its import screen. Import each key on one machine only: running the same key twice gets you slashed." },
      { title: "Set your fee recipient", body: "In the same Setup tab, set the Ethereum address that receives transaction tips. Without it you miss that part of your rewards." },
      { title: "Check the result", body: "Come back to Home. When everything is in place the setup findings disappear.", action: { label: "Go to Home", to: "/dashboard" } },
    ],
  },
  {
    id: "sync", title: "Not syncing or not working", when: "An app is stopped, restarting, or behind the chain.",
    findingTopics: ["sync", "core"],
    steps: [
      { title: "Look at the findings above", body: "They show which app is affected and offer a fix." },
      { title: "Read the app's logs", body: "Open the app, then the Logs tab. The last error before a restart is usually the cause." },
      { title: "Restart the app", body: "Use Restart on the app's Overview tab. Most transient problems clear with a restart." },
      { title: "Check disk and peers", body: "A full disk or very few peers stop clients from following the chain.", action: { label: "Open Storage", to: "/system/storage" } },
    ],
  },
  {
    id: "attestations", title: "Missed attestations", when: "Rewards lower than expected, or attestations missed.",
    findingTopics: ["attestations", "sync"],
    steps: [
      { title: "Install monitoring if you haven't", body: "The monitoring package lets your AVADO count missed attestations and show them here.", action: { label: "Install monitoring", to: "/installer/grafana.avado.dappnode.eth" } },
      { title: "Make sure both clients are synced", body: "A consensus client that follows an unsynced execution client cannot attest correctly." },
      { title: "Check peers and ports", body: "Fewer than 10 peers makes attestations arrive late.", action: { label: "Network help", to: "/help/access" } },
      { title: "Check that the box clock is right", body: "Attestations are time-sensitive. Reboot the box if its time was wrong after a power cut." },
    ],
  },
  {
    id: "updates", title: "Updates and versions", when: "An update didn't install, or you're not sure what version you run.",
    findingTopics: ["updates"],
    steps: [
      { title: "See what can be updated", body: "System → Updates lists every app with a newer version.", action: { label: "Open Updates", to: "/system/updates" } },
      { title: "Keep automatic updates on for clients", body: "Clients must update before network upgrades. Automatic updates install them for you." },
      { title: "If an update seems stuck", body: "Wait 15 minutes, then reload this page. If the app is still on the old version, restart it and try the update again." },
    ],
  },
  {
    id: "access", title: "Access and network", when: "Can't reach my.ava.do, Wi-Fi, Remote Connect, ports.",
    findingTopics: ["access"],
    steps: [
      { title: "Reaching your AVADO at home", body: "Use http://my.ava.do from a device on the same network, or the AVADO's Wi-Fi hotspot." },
      { title: "Open the peer-to-peer ports", body: "Turn on UPnP in your router, or forward the ports listed on each client's Overview tab to your AVADO's internal IP." },
      { title: "Reaching it from away", body: "Remote Connect gives you secure access from anywhere.", action: { label: "Open Remote Connect", to: "/packages/remoteconnect.avado.dnp.dappnode.eth" } },
    ],
  },
  {
    id: "storage", title: "Disk space", when: "Disk almost full, or an app uses a lot of space.",
    findingTopics: ["storage"],
    steps: [
      { title: "See what uses the space", body: "System → Storage lists each app's disk use.", action: { label: "Open Storage", to: "/system/storage" } },
      { title: "Clean up unused images", body: "Old versions of apps stay on disk after updates. Cleaning them up is safe." },
      { title: "Shrink an execution client", body: "Resetting an execution client's data makes it sync again and frees space. Never reset a consensus client yourself: it holds your validator keys." },
    ],
  },
];
```

- [ ] **Step 6: Implement `HelpHome.jsx`, `HelpTopic.jsx`, `ReportPanel.jsx`**

- `HelpHome`: `PageHeader` "Help" / "Find what's wrong and fix it, or get in touch with us." A grid (1 col on phones, 2 on ≥640 px, 3 on ≥1024 px) of six tiles (`Link` to `/help/{id}`), each with the topic title, `when`, and a status dot: red if any `allFindings` of its `findingTopics` is critical, amber for warning, green otherwise. Below: `<ReportPanel />`, then "Community" with Docs (docs.ava.do), YouTube, Telegram links (copy from the current `TroubleshootHome` RESOURCES), then for Priority subscribers a line linking to `/priority`.
- `HelpTopic`: reads `:topic`, renders `NotFound` for unknown ids. `PageHeader` with the topic title and a "Help" eyebrow linking back; a panel "What your AVADO sees" with `FindingRow`s for matching `allFindings` (or "No problems found for this topic." in success text); an ordered list of steps (numbered: this content is a real sequence); then "Still stuck?" with `<ReportPanel compact />`.
- `ReportPanel`: builds the report with `buildReport` from `useHealth()` and redux data (`versions`: `{ admin: window.versionData?.version, dappmanager: dappmanagerVersionData?.version }` plus each core package's version); buttons "Download report" (`file-saver` `saveAs(new Blob([report], {type: "text/plain"}), "avado-report.txt")`), "Copy report" (`navigator.clipboard.writeText`, toast "Report copied"), "Email support" (`href={mailtoReport(...)}`), and a "Show what's in it" disclosure rendering the report in a `pre` with `font-mono text-xs` and `max-h-80 overflow-auto`.

- [ ] **Step 7: Route**

`TroubleshootRoot.jsx`:
```jsx
import React from "react";
import { Route, Switch } from "react-router-dom";
import HelpHome from "./HelpHome";
import HelpTopic from "./HelpTopic";

export default function TroubleshootRoot() {
  return (
    <Switch>
      <Route exact path="/help" component={HelpHome} />
      <Route path="/help/:topic" component={HelpTopic} />
    </Switch>
  );
}
```

- [ ] **Step 8: Run tests, build, browser-check**

Run: `npm test && npm run build`. Check `/#/help`: the Validator setup tile is red on the test box. `/#/help/setup` shows the Nimbus finding and the four steps. Download the report and read it: no env values, no public IP. "Email support" opens a mail draft. `/#/help/nope` shows not found.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "feat(help): guided troubleshooter topics and a safe diagnostics report"
```

---

### Task 16: Staking setup checklist

**Files:**
- Create: `src/pages/staking/index.js`, `src/pages/staking/data.js`
- Create: `src/pages/staking/steps.js`
- Create: `src/pages/staking/components/StakingSetup.jsx`
- Test: `src/pages/staking/__tests__/steps.test.js`
- Modify: `src/pages/index.js` (add `staking`, and `help` if the troubleshoot page's export key is renamed — keep the key `troubleshoot`)
- Modify: `src/components/navbar/navbarItems.js` (add "Staking setup" after My DApps; reuse an existing icon from `Icons/`)

**Interfaces:**
- Consumes: `clientsByRole`, `ROLES`, `GRAFANA_PACKAGE`, `PROMETHEUS_PACKAGE` (Task 3); `wizardUrl` (Task 13); localStorage.
- Produces: `stakingSteps(packages, manual) → [{ id, title, why, state: "done"|"todo"|"optional", auto: boolean, action: {label,to}|null }]`, `manual` being `{ keys?: boolean, feeRecipient?: boolean }`; storage key `avado.stakingSetup.<consensusPackageName>`.

- [ ] **Step 1: Write the failing test**

```js
import { stakingSteps } from "pages/staking/steps";

const p = name => ({ name, state: "running" });

describe("stakingSteps", () => {
  it("detects installed clients and leaves manual steps to the user", () => {
    const steps = stakingSteps([p("nimbus.avado.dnp.dappnode.eth")], {});
    const by = Object.fromEntries(steps.map(s => [s.id, s]));
    expect(by.execution.state).toBe("todo");
    expect(by.consensus.state).toBe("done");
    expect(by.keys).toMatchObject({ state: "todo", auto: false, action: { to: "/packages/nimbus.avado.dnp.dappnode.eth?tab=setup" } });
    expect(by.mev.state).toBe("optional");
    expect(by.monitoring.state).toBe("optional");
  });
  it("marks everything done when installed and ticked", () => {
    const steps = stakingSteps(
      ["ethchain-geth.public.dappnode.eth", "nimbus.avado.dnp.dappnode.eth", "mevboost.avado.dnp.dappnode.eth", "grafana.avado.dappnode.eth"].map(p),
      { keys: true, feeRecipient: true }
    );
    expect(steps.every(s => s.state === "done")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/pages/staking`
Expected: FAIL.

- [ ] **Step 3: Implement `steps.js`**

```js
import { clientsByRole, ROLES, GRAFANA_PACKAGE } from "health/clients";

export function stakingSteps(packages, manual = {}) {
  const has = role => clientsByRole(packages, role).filter(x => x.client.network === "mainnet" || role === ROLES.MONITORING);
  const cc = has(ROLES.CONSENSUS)[0];
  const ccSetup = cc ? { label: `Open ${cc.client.label} setup`, to: `/packages/${cc.pkg.name}?tab=setup` } : null;
  const installed = name => (packages || []).some(x => x.name === name);
  return [
    { id: "execution", title: "Install an execution client", why: "It follows the Ethereum chain. Geth and Nethermind are available.", auto: true,
      state: has(ROLES.EXECUTION).length ? "done" : "todo", action: { label: "Choose one", to: "/installer?category=ethstaking" } },
    { id: "consensus", title: "Install a consensus client", why: "It follows the beacon chain and runs your validators. Nimbus, Teku and Prysm are available.", auto: true,
      state: cc ? "done" : "todo", action: { label: "Choose one", to: "/installer?category=ethstaking" } },
    { id: "keys", title: "Import your validator keys", why: "Import each key on this AVADO only. The same key running on two machines gets slashed.", auto: false,
      state: manual.keys ? "done" : "todo", action: ccSetup },
    { id: "feeRecipient", title: "Set your fee recipient", why: "The address that receives transaction tips from the blocks you propose.", auto: false,
      state: manual.feeRecipient ? "done" : "todo", action: ccSetup },
    { id: "mev", title: "Add MEV-Boost", why: "Optional. Earns more from the blocks you propose.", auto: true,
      state: installed("mevboost.avado.dnp.dappnode.eth") ? "done" : "optional", action: { label: "Install MEV-Boost", to: "/installer/mevboost.avado.dnp.dappnode.eth" } },
    { id: "monitoring", title: "Add monitoring", why: "Optional. Dashboards, and warnings about missed attestations on Home.", auto: true,
      state: installed(GRAFANA_PACKAGE) ? "done" : "optional", action: { label: "Install monitoring", to: `/installer/${GRAFANA_PACKAGE}` } },
  ];
}
```

- [ ] **Step 4: Implement the page**

`data.js`: `export const rootPath = "/staking"; export const title = "Staking setup";`. `index.js` follows the dashboard page's shape (`rootPath`, `RootComponent: StakingSetup`).

`StakingSetup.jsx`: `PageHeader` "Staking setup" / "Everything a validator on Ethereum mainnet needs, in order." An `ol` panel (numbered: this is a real sequence) where each row shows a state marker (filled check in brand for done, empty circle for to-do, dashed circle with the word "Optional"), title, `why`, and the action link. For manual steps (`auto: false`) show a checkbox "I've done this" bound to localStorage key `avado.stakingSetup.<cc name>` (try/catch around storage). Above the list: "{n} of 4 required steps done" with a thin progress bar. When the consensus client isn't installed, manual steps show "Install a consensus client first" instead of the action.

- [ ] **Step 5: Register and run**

Add `staking` to `src/pages/index.js` and the nav item `{ name: "Staking setup", href: "/staking", icon: <an existing icon> }`. Run `npm test && npm run build`, then check `/#/staking` on the test box: execution to-do, consensus done, manual steps link to Nimbus setup.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(staking): setup checklist with detected and manual steps"
```

---

### Task 17: Remote Connect / VPN empty state

**Files:**
- Modify: `src/pages/devices/components/DevicesHome.jsx` (or wherever `"Could not load devices"` renders; `grep -rn "Could not load devices" src`)

**Interfaces:**
- Consumes: `Card`, `Button`.

- [ ] **Step 1: Replace the error visual**

When the error message says the VPN package is not installed, render a `Card` with title "Remote access isn't set up", body "Install Remote Connect to reach your AVADO securely when you're away from home.", and a primary `Button` "Install Remote Connect" linking to `/installer/remoteconnect.avado.dnp.dappnode.eth`. Remove the large cyan ✕. Other errors keep their message, shown with the standard `EmptyState` danger tone.

- [ ] **Step 2: Build and browser-check**

Run `npm run build`; open `/#/devices` on the test box and confirm the empty state.

- [ ] **Step 3: Commit**

```bash
git add -A src
git commit -m "feat(devices): helpful empty state when remote access is not installed"
```

---

### Task 18: System — Overview, Updates, Storage, History tabs

**Files:**
- Create: `src/pages/system/components/SystemTabs.jsx`
- Create: `src/pages/system/components/SystemUpdates.jsx`
- Create: `src/pages/system/components/SystemStorage.jsx`
- Create: `src/pages/system/components/SystemHistory.jsx`
- Create: `src/pages/system/signedCommands.js` (move the disk-cleanup, reboot and shutdown command objects out of `SystemHome.jsx`)
- Modify: `src/pages/system/components/SystemRoot.jsx`, `SystemHome.jsx`
- Modify: `src/components/navbar/navbarItems.js` (nothing new; System stays one item)
- Test: `src/pages/system/__tests__/storage.test.js`

**Interfaces:**
- Consumes: `useHealth` (`updates`, `allFindings`), `getCoreUpdateAvailable`, `getCoreDeps`, `getDnpInstalled`, `getDappnodeStats`, `getUserActionLogs`, `appDiskUse`, `getClient`, `AppAvatar`, `prettyBytes` (Task 13), existing `SystemUpdate`, existing `confirmSignedCmd` flow, `AppPage` (Task 13).
- Produces: routes `/system` (Overview), `/system/updates`, `/system/storage`, `/system/history`, `/system/update` (existing core update flow, unchanged), `/system/:id` (core app page). `storageRows(packages) → [{ pkg, size, share }]` sorted by size desc, `share` of the total app usage.

- [ ] **Step 1: Write the failing storage test**

```js
import { storageRows } from "pages/system/components/SystemStorage";

describe("storageRows", () => {
  it("sorts apps by disk use and computes shares", () => {
    const rows = storageRows([
      { name: "a", volumes: [{ size: 100 }] },
      { name: "b", volumes: [{ size: 300 }, { size: 100 }] },
      { name: "c", volumes: [] },
    ]);
    expect(rows.map(r => r.pkg.name)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ size: 400, share: 0.8 });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/pages/system`
Expected: FAIL.

- [ ] **Step 3: Implement the tabs and pages**

- `signedCommands.js`: export `DISK_CLEANUP`, `SHUTDOWN` objects (`{ command, sig }` copied verbatim from `SystemHome.jsx`) and `REBOOT` behaviour stays via `rebootHost`. `SystemHome` imports them. Do not change a signature.
- `SystemTabs`: `Tabs` with Overview · Updates (badge: number of updates + 1 if a core update is available) · Storage · History; `onChange` pushes `/system`, `/system/updates`, etc.
- `SystemUpdates`: a panel listing `useHealth().updates` rows (avatar, title, "0.0.48 → 0.0.49", button "Update" linking to `/installer/{name}`); empty text "All apps are up to date." or, when `sources.updates === "failed"`, "Can't check for updates right now: your AVADO can't reach the AVADO store." Then a "System update" panel: when `getCoreUpdateAvailable`, list `getCoreDeps` (`from → to`) with a primary button "Update system" linking to `/system/update` and the note "Keep your AVADO powered on during the update. It takes a few minutes."; otherwise "Your AVADO system is up to date."
- `SystemStorage`: the disk meter (as on Home), `storageRows` as bar rows (`AppAvatar` 28 px, title, `prettyBytes(size)`, a bar of `share`), each row with the client's `pruneAdvice` in a disclosure; a "Clean up unused images" secondary button running the existing disk-cleanup confirm flow with `DISK_CLEANUP`.
- `SystemHistory`: `getUserActionLogs` as rows: time (`toLocaleString`), a status dot for `level` (error → danger), readable action (`event.split(".")[0]` converted from camelCase to words, e.g. "Restart package"), app (`kwargs.id` short name), message; a select to filter by app; "No activity yet." when empty.
- `SystemRoot`:
```jsx
<>
  <SystemTabs />
  <Switch>
    <Route exact path="/system" component={SystemHome} />
    <Route path="/system/updates" component={SystemUpdates} />
    <Route path="/system/storage" component={SystemStorage} />
    <Route path="/system/history" component={SystemHistory} />
    <Route path={"/system/" + updatePath} component={SystemUpdate} />
    <Route path="/system/:id" render={props => <AppPage {...props} isCore />} />
  </Switch>
</>
```
Render `SystemTabs` only for the four tab routes (not on `/system/update` or `/system/:id`).
- Delete `src/pages/activity/` and its entry in `src/pages/index.js` once `SystemHistory` covers it (the `/activity` redirect exists from Task 11).

- [ ] **Step 4: Re-enable the core update notice**

Uncomment the `NotificationsMain` block in `App.jsx` only if it renders correctly with the new tokens. If it doesn't, leave it commented: the `core-update-available` finding on Home now covers it.

- [ ] **Step 5: Run tests, build, browser-check**

Run `npm test && npm run build`. Check each System tab on the test box; the Storage bars show Nimbus and Prometheus; History lists recent installs.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(system): updates, storage and history tabs"
```

---

### Task 19: DappStore polish

**Files:**
- Modify: `src/pages/installer/components/ManifestStore.jsx`
- Modify: `src/pages/installer/components/StorePresentation.jsx` (`CategoryHeader` sentence case)
- Modify: `src/pages/installer/components/InstallerHome.jsx` (`?category=` filter support)

**Interfaces:**
- Consumes: `AppAvatar`, `appDescription`.
- Produces: `/installer?category=<tag>` scrolls to and highlights that category (used by the setup findings).

- [ ] **Step 1: Cards**

In `ManifestStore.jsx`: title without `truncate` (`break-words`, up to 2 lines with `line-clamp-2`), description `line-clamp-3`, `AppAvatar` for the icon, version in `font-mono text-xs`, and the button labels "Install", "Update to vX", "Installed" (disabled look but still navigates to the app page).

- [ ] **Step 2: Category headers and filter**

`CategoryHeader`: render `title` as given (the store sends "ETH Staking"; stop applying `uppercase` or `tracking-wider`). In `InstallerHome`, read `new URLSearchParams(location.search).get("category")`; when present, render that category first with a "Showing {description}" line and a "Show all" link that clears the query.

- [ ] **Step 3: Build and browser-check**

Run `npm run build`. Check `/#/installer` and `/#/installer?category=ethstaking` at 360 and 1440 px: full titles, no overflow.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat(store): full titles, sentence-case categories, category filter"
```

---

### Task 20: Command palette (⌘K)

**Files:**
- Create: `src/components/palette/commands.js`
- Create: `src/components/palette/CommandPalette.jsx`
- Test: `src/components/palette/__tests__/commands.test.js`
- Modify: `src/components/navbar/TopBar.jsx` (search button that opens the palette; label "Search" ≥1024 px, `⌘K` hint)
- Modify: `src/App.jsx` (mount `<CommandPalette />` inside `HealthProvider`)

**Interfaces:**
- Consumes: `sidenavItems`, `TOPICS` (Task 15), installed packages, `storePackages` from `useHealth`, `DISK_CLEANUP` flow (Task 18), `restartPackage`.
- Produces: `buildCommands({ packages, storePackages, topics, nav }) → [{ id, label, group: "Pages"|"Your apps"|"DappStore"|"Help"|"Actions", keywords, to?, run? }]`; `searchCommands(commands, query) → Command[]` (case-insensitive substring over label + keywords, ranked: label prefix > label contains > keyword contains; max 20).

- [ ] **Step 1: Write the failing test**

```js
import { buildCommands, searchCommands } from "components/palette/commands";

const commands = buildCommands({
  nav: [{ name: "Home", href: "/dashboard" }, { name: "Help", href: "/help" }],
  packages: [{ name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus Consensus Client" } }],
  storePackages: [{ manifest: { name: "teku.avado.dnp.dappnode.eth", title: "Teku Consensus Client" } }],
  topics: [{ id: "storage", title: "Disk space", when: "Disk almost full" }],
});

describe("command palette", () => {
  it("covers pages, apps, store, help and actions", () => {
    const groups = new Set(commands.map(c => c.group));
    expect([...groups].sort()).toEqual(["Actions", "DappStore", "Help", "Pages", "Your apps"]);
  });
  it("ranks label prefixes first and matches keywords", () => {
    expect(searchCommands(commands, "nim")[0].label).toBe("Nimbus Consensus Client");
    expect(searchCommands(commands, "restart")[0].label).toBe("Restart Nimbus Consensus Client");
    expect(searchCommands(commands, "full").map(c => c.label)).toContain("Disk space");
    expect(searchCommands(commands, "")).toHaveLength(Math.min(commands.length, 20));
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/components/palette`
Expected: FAIL.

- [ ] **Step 3: Implement `commands.js`**

```js
import { appTitle } from "health/rules/apps";

export function buildCommands({ nav = [], packages = [], storePackages = [], topics = [] }) {
  const installed = new Set(packages.map(p => p.name));
  return [
    ...nav.map(n => ({ id: `page:${n.href}`, group: "Pages", label: n.name, keywords: "", to: n.href })),
    { id: "page:updates", group: "Pages", label: "Updates", keywords: "system upgrade version", to: "/system/updates" },
    { id: "page:storage", group: "Pages", label: "Storage", keywords: "disk space full", to: "/system/storage" },
    { id: "page:history", group: "Pages", label: "History", keywords: "activity log", to: "/system/history" },
    ...packages.filter(p => !p.isCore).map(p => ({ id: `app:${p.name}`, group: "Your apps", label: appTitle(p), keywords: p.name, to: `/packages/${p.name}` })),
    ...packages.filter(p => !p.isCore).map(p => ({ id: `restart:${p.name}`, group: "Actions", label: `Restart ${appTitle(p)}`, keywords: "restart reboot app", action: { type: "restart", id: p.name } })),
    ...(storePackages || []).filter(p => p.manifest && !installed.has(p.manifest.name)).map(p => ({
      id: `store:${p.manifest.name}`, group: "DappStore", label: p.manifest.title || p.manifest.name, keywords: `install ${p.manifest.name}`, to: `/installer/${p.manifest.name}`,
    })),
    ...topics.map(t => ({ id: `help:${t.id}`, group: "Help", label: t.title, keywords: t.when, to: `/help/${t.id}` })),
    { id: "action:cleanup", group: "Actions", label: "Clean up unused images", keywords: "disk space free prune", action: { type: "diskCleanup" } },
    { id: "action:report", group: "Actions", label: "Download diagnostics report", keywords: "support help report", to: "/help" },
  ];
}

export function searchCommands(commands, query) {
  const q = query.trim().toLowerCase();
  if (!q) return commands.slice(0, 20);
  const score = c => {
    const l = c.label.toLowerCase();
    if (l.startsWith(q)) return 0;
    if (l.includes(q)) return 1;
    if ((c.keywords || "").toLowerCase().includes(q)) return 2;
    return 9;
  };
  return commands.map(c => [score(c), c]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).slice(0, 20).map(([, c]) => c);
}
```

- [ ] **Step 4: Implement `CommandPalette.jsx`**

A modal (reuse `components/ui/Modal` if it supports a custom body; otherwise a fixed overlay `bg-bg/70 backdrop-blur-sm` with a `surface-raised` panel, `max-w-xl`, top offset 12vh, full width minus 16 px on phones). Opens on ⌘K / Ctrl-K, on `/` when focus is not in an input, and on a `window` event `avado:open-palette` dispatched by the top-bar button. Input with `role="combobox"`, `aria-expanded`, `aria-controls`; results `role="listbox"` grouped with group headings; ArrowUp/ArrowDown move, Enter runs (`history.push(to)` or the action: `restart` → `dispatch(restartPackage(id))`, `diskCleanup` → the confirm flow from `signedCommands`), Escape closes. Focus returns to the element that opened it.

- [ ] **Step 5: Run tests, build, browser-check**

Run `npm test && npm run build`. In the browser press ⌘K, type "nim", press Enter: lands on the Nimbus app page. Type "disk": Storage, Disk space and Clean up appear.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(nav): command palette for pages, apps, help and actions"
```

---

### Task 21: Sentence-case sweep and remaining visual polish

**Files:**
- Modify: any file under `src/` whose rendered text uses `uppercase`, `tracking-wider` or all-caps labels (`grep -rn "uppercase\|tracking-wider" src --include=*.jsx`)
- Modify: `src/components/ui/Table.jsx` (`TH` sentence case, no uppercase)
- Modify: `src/components/ui/PageHeader.jsx` (`h1` uses `font-display`)
- Modify: `src/layout.css` (mobile sidebar overlay under 1024 px, 16 px gutters under 640 px)

- [ ] **Step 1: Sweep**

Remove `uppercase` and `tracking-wider` from rendered labels (table headers, section eyebrows, the "DApp" label on app pages). Keep them only where the source text is already an acronym. `PageHeader` `h1` gets `font-display`.

- [ ] **Step 2: Mobile layout**

Under 1024 px the sidebar is off-canvas, opened by the existing burger (`toggleSideNav`), with an overlay that closes it on tap and on route change. Under 640 px `#main` has 16 px side padding. Verify no page scrolls horizontally at 360 px.

- [ ] **Step 3: Build and full visual pass**

Run `npm run build`. With the dev server against the test box, visit every route at 360, 768 and 1440 px in both themes: `/dashboard`, `/installer`, `/installer?category=ethstaking`, `/packages`, `/packages/nimbus.avado.dnp.dappnode.eth` (all tabs), `/packages/grafana.avado.dappnode.eth`, `/staking`, `/devices`, `/priority`, `/help`, `/help/setup`, `/system`, `/system/updates`, `/system/storage`, `/system/history`, `/nope`. Fix anything clipped, truncated, overflowing or low-contrast. Save a screenshot per page at 1440 px dark and 360 px light into the session scratchpad for the final report.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "style: sentence case, display font for titles, mobile layout"
```

---

### Task 22: Lint, full test run, release to staging and upgrade the test box

**Files:**
- Modify: `dappnode_package.json`, `docker-compose.yml` (version bump 10.0.51 → 10.0.52), `releases.json` untouched (CI writes it)

- [ ] **Step 1: Verify**

Run: `npm run lint && npm test && npm run build` (from `build/src`).
Expected: no lint errors in changed files, all tests pass, build succeeds. Fix before continuing.

- [ ] **Step 2: Bump the version**

At the repository root set `"version": "10.0.52"` in `dappnode_package.json` and the image tag `admin.dnp.dappnode.eth:10.0.52` in `docker-compose.yml`.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin ux/self-help
gh pr create --title "Admin 10.0.52: self-help UX overhaul" --body "<summary of the spec, test results, and screenshots>"
```
Wait for the Build check to pass. If `main`/`master` moved since this branch was created, merge it in first, so the release artifact's diff applies (see memory: release CI diff artifact).

- [ ] **Step 4: Release to staging**

Merge with a merge commit (`git merge --no-ff` then push), wait for the Release workflow, and confirm `releases.json` gained `10.0.52`.

- [ ] **Step 5: Upgrade the test box and verify**

On the test box (staging-flagged) update the Admin from the DappStore / System → Updates. Then, in Chrome against http://my.ava.do, repeat the Task 21 visual pass on the real image. Confirm: Home verdict and findings, Nimbus app page tabs, Help report download, Staking setup, System tabs, ⌘K, and that the DAPPMANAGER and other packages still work (restart Grafana from its Overview tab; it comes back running).

- [ ] **Step 6: Report**

Summarise to the owner: what changed, screenshots, test counts, and the promotion order (Admin 10.0.52 can go to production independently of the DAPPMANAGER).
