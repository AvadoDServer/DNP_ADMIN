# Admin visual redesign (10.0.53) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved "Appliance" visual system (light + dark), a Simple/Advanced mode, the chain strip and a same-origin Prometheus proxy to the whole Admin, without changing what 10.0.52 does.

**Architecture:** Tokens in `theme.css` drive everything (Tailwind reads them). A `ModeProvider` (like `ThemeProvider`) holds simple/advanced; pure helpers decide what each mode shows. Shared components carry the new look so pages mostly re-compose them. nginx in the Admin container proxies read-only Prometheus queries. Home is rebuilt from the approved mockups.

**Tech Stack:** unchanged (React 18, react-router 5, redux, Vite 5, Tailwind 3.4, Vitest); new font `@fontsource/public-sans` (added with **Yarn 1**, lockfile validated).

**Spec:** `docs/superpowers/specs/2026-09-23-admin-visual-redesign-design.md` · **Mockups:** `docs/superpowers/specs/mockups/home-light-simple.dc.html`, `home-dark-advanced.dc.html` (open them as plain HTML source: every colour, size and spacing value in them is the reference).

All paths relative to `build/src/` unless starting with `docs/` or `build/`.

## Global Constraints

- Admin-only release. No DAPPMANAGER/WAMP/crossbar/OS change; no kernel modules; no new WAMP calls.
- Spec §6.0: NO sensor reader, NO temperature/network/disk-activity/uptime readings, NO cpu-hot/disk-hot/sensor-stale checks in this release.
- Keep token *names* (`--bg`, `--surface`, `--surface-raised`, `--border`, `--fg`, `--fg-muted`, `--fg-subtle`, `--accent`, `--brand`, `--success`, `--warning`, `--danger`, `--verdict-*`); change their values per spec §3 (`--success`=ok, `--warning`=warn, `--danger`=crit). Add `--chrome` and `--accent-fg`.
- Fonts: Sen (display) + Public Sans (body; Inter removed). JetBrains Mono stays for logs only.
- Sentence case; plain verbs; no all-caps; AA contrast in both themes.
- Simple mode never hides a problem; deep links to Advanced-only pages work in Simple with an "Advanced page" note; Remote Connect stays in Simple's sidebar when installed.
- Every destructive action keeps its existing confirmation; signed commands untouched.
- Dependencies only via `yarn add` in build/src; after any change: `node -e "require('@yarnpkg/lockfile').parse(...)"` must pass and `yarn install --frozen-lockfile` in a clean temp copy must pass (see memory note: npm corrupts yarn.lock).
- Tests (`npm test`), lint (0 errors), build must pass before every commit. Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Dark/light parity:** every restyled component and page readable in both themes (no hard-coded light colours on dark or vice versa). → contrast test (T1) + controller browser pass.
2. **Mode leaks:** an Advanced-only control or nav item visible in Simple, or a problem hidden in Simple. → `visibleNavItems`/`tabsFor` tests (T2, T7) + FindingRow link test.
3. **Proxy failure paths:** Prometheus not installed / stopped / DNS missing → no errors thrown, falls back, `metrics-unavailable` or `monitoring-stopped` shown correctly. → T3 tests.
4. **Legacy Bootstrap pages** (Envs, FileManager, Logs, Controls, Priority, devices) still usable after the shell/token change. → controller browser pass.
5. **Reduced motion and focus:** status-light pulse respects `prefers-reduced-motion`; every control keeps a visible focus ring on the new backgrounds. → T5 test for focus class; browser pass.

---

## Wave 1 (parallel)

### Task 1: Tokens, fonts, theme switch

**Files:** `src/theme.css`, `tailwind.config.js`, `src/index.jsx`, `src/index.css`, `src/theme/ThemeProvider.jsx`, `src/theme/__tests__/contrast.test.js`, `src/theme/__tests__/ThemeProvider.test.jsx` (new), `package.json`, `yarn.lock`.

**Interfaces — Produces:** tokens per spec §3 in both theme blocks (dark values also under `:root`); new `--chrome` (light `246 248 251`, dark `13 26 54`) and `--accent-fg` (light `255 255 255`, dark `10 21 48`); Tailwind colors `chrome`, `accent.fg` (exists — verify); `fontFamily.sans` = `["Public Sans", …]`, `fontFamily.display` = `["Sen", …]`; `ThemeProvider` exposes `{ theme, preference, setPreference("light"|"dark"|"system") }` (keep `setTheme`/`toggleTheme` working for existing callers); `preference` persisted in localStorage `theme` (`"system"` clears the key and follows `prefers-color-scheme`, updating live on change).

- [ ] Add font: `yarn add @fontsource/public-sans@^5`; remove `@fontsource/inter` imports from `index.jsx` (and the package with `yarn remove`); import public-sans 400/500/600/700; validate yarn.lock as in Global Constraints.
- [ ] Write/extend the contrast test for the new values: pairs fg/bg, fg/surface, fg-muted/surface, fg-muted/bg, accent-fg/accent (≥4.5), success/warning/danger/brand on surface (≥3), in both themes. Run → fail. Set the token values (spec §3 table; light `--fg-subtle` `110 124 150`… choose values that pass). Run → pass.
- [ ] ThemeProvider test (RTL): default follows matchMedia; `setPreference("light")` persists and sets `data-theme="light"`; `setPreference("system")` removes the key and follows a mocked matchMedia change.
- [ ] Body base: `src/index.css` body `font-size: 16px; line-height: 1.55; background: rgb(var(--bg)); color: rgb(var(--fg))`. 
- [ ] Suite, lint, build; commit `feat(theme): Appliance tokens, Public Sans, light/dark/system theme`.

### Task 2: Simple/Advanced mode system

**Files:** `src/settings/ModeProvider.jsx` (new), `src/settings/visibility.js` (new), `src/settings/__tests__/*.test.js(x)`, `src/App.jsx` (wrap inside HealthProvider), `src/components/navbar/navbarItems.js` (flags only).

**Interfaces — Produces:**
```js
// settings/ModeProvider.jsx
export function ModeProvider({ children })            // localStorage "avado.mode", default "simple", try/catch
export function useMode() // → { mode: "simple"|"advanced", isAdvanced: boolean, setMode(m), toggleMode() }
// settings/visibility.js
export function visibleNavItems(items, { mode, installedNames })
// items gain optional `advanced: true`; package/hideif rules unchanged; an item with `simpleIfInstalled: true`
// (Remote Connect) stays visible in simple when its package is installed.
export const ADVANCED_TABS = ["logs", "settings", "files"];
export function tabsForMode(tabs, mode) // simple drops ADVANCED_TABS
export const SIMPLE_HIDDEN_STORE_CATEGORIES = ["testnets", "thelab", "sunset", "aux", "avadosystem"];
```
navbarItems: `System`, `Connect (VPN)` get `advanced: true`; `Remote Connect` gets `advanced: true, simpleIfInstalled: true`. Priority stays visible in simple (ruling: the paid support offer's audience is non-technical owners).

- [ ] Tests first: default simple; persistence; corrupted storage → simple; `visibleNavItems` simple = Home, DappStore, My DApps, Staking setup, Help, Priority (+ Remote Connect when installed); advanced = all (package/hideif still applied); `tabsForMode`.
- [ ] Implement; mount `<ModeProvider>` in App.jsx inside `<HealthProvider>` (App.jsx: minimal change).
- [ ] Suite, lint, build; commit `feat(settings): simple/advanced mode`.

### Task 3: Prometheus proxy and chain progress

**Files:** `build/nginx.conf`, `src/health/prometheus.js`, `src/health/__tests__/prometheus.test.js`, `src/health/rules/setup.js` (monitoringStopped), `src/health/rules/index.js`, `src/health/chainProgress.js` (new) + test.

**Interfaces — Produces:**
- nginx, inside the existing `server { listen 80; }`, before `location /`:
```nginx
location /metrics-api/ {
    limit_except GET { deny all; }
    resolver 127.0.0.11 valid=10s ipv6=off;
    set $prom http://prometheus.my.ava.do:9090;
    rewrite ^/metrics-api/(query|query_range)$ /api/v1/$1 break;
    if ($uri !~ ^/api/v1/(query|query_range)$) { return 404; }
    proxy_pass $prom;
    proxy_connect_timeout 3s;
    proxy_read_timeout 10s;
}
```
  (verify with `nginx -t` using the admin image: `docker run --rm -v $PWD/build/nginx.conf:/etc/nginx/nginx.conf:ro nginx:1.23.1-alpine nginx -t`).
- `prometheus.js`: `PROMETHEUS_BASES = ["/metrics-api", "http://prometheus.my.ava.do:9090/api/v1"]`; `query()` tries the remembered-working base first, then the other; remembers the working one in module state; keeps the 10 s AbortController; `fetchMetrics` still returns `null` when all bases fail. Add `QUERIES.headSlotRaw` unchanged. Export `resetPrometheusBase()` for tests.
- `chainProgress.js`: `epochProgress({ network, headSlot, now }) → { epoch, slotInEpoch, wallSlot, behind, cells: Array<"seen"|"missing"|"now"|"future"> } | null` using `NETWORKS` and `currentSlot`; cells length = slotsPerEpoch; slots ≤ headSlot within the current epoch = "seen", slots between headSlot and wallSlot = "missing", wallSlot = "now", later = "future". Null when network unknown or headSlot missing.
- `monitoringStopped` rule: when the Prometheus package is installed and `running === false` → warning, topic "attestations", title "Monitoring has stopped", fix action `restartPackage` (appId = prometheus package), label "Restart monitoring". Register in ALL_RULES.
- [ ] Tests first (proxy then direct fallback; remembers base; all fail → null; epochProgress fixtures incl. behind 0/2/40 and gnosis 16-slot epochs; monitoringStopped). Implement. Suite/lint/build; nginx -t. Commit `feat(metrics): same-origin Prometheus proxy, epoch progress, monitoring-stopped check`.

## Wave 2 (after Tasks 1–2 are merged)

### Task 4: App shell — sidebar and top bar

**Files:** `src/components/navbar/SideBar.jsx`, `sidebar.css`, `TopBar.jsx`, `topbar.css`, `src/components/navbar/SidebarFooter.jsx` (new), tests in `components/navbar/__tests__/`, `src/layout.css`.

**Requirements (mockup is the reference):** sidebar 248 px, `bg-surface` + right border, AVADO wordmark (existing `img/avado-logo-v1.1.svg`, themed via CSS filter in dark or the text wordmark as in mockup), nav items 46 px high, 14 px radius, icon 20 px + label, active = `bg-accent text-accent-fg` pill; items from `visibleNavItems`. Footer card: box name (`getDappnodeParams().name`, fallback "My AVADO") with a button that opens the existing identity details (reuse DappnodeIdentity content in a small popover), segmented Light/Dark (plus "Match computer" as a third small option or a menu), segmented Simple/Advanced, "Version x.y.z" (hidden if unknown). Top bar (`bg-chrome`, 68 px): search button (existing palette opener) and Notifications only; remove ThemeToggle, ChainData, Report and identity from the top bar. Mobile: keep off-canvas behaviour and tests; burger stays in the top bar under 1024 px.
- [ ] Tests: sidebar shows simple items by default; switching to Advanced shows System; footer theme switch calls setPreference; version hidden when unknown.
- [ ] Implement; suite/lint/build; commit.

### Task 5: Shared components in the new style

**Files:** `src/components/ui/{Button,Card,Badge,StatusPill,Tabs,Table,Input,Modal,Skeleton,PageHeader}.jsx`, `src/components/health/FindingRow.jsx`, `src/components/apps/AppCard.jsx` (becomes the "bay"), `src/components/palette/CommandPalette.jsx` (panel style only), confirm-dialog styling (`react-confirm-alert` custom UI used by confirm* helpers — find its shared Dialog component), toast CSS, their tests.

**Requirements:** Button primary = pill, `bg-accent text-accent-fg`, 44 px default height (touch), secondary = pill with border, ghost unchanged; Card = radius 20 px, light: no border + `0 1px 0 rgb(var(--border))` shadow, dark: 1 px border; StatusPill → "status light" (8–10 px dot + word, no pill border) keeping its props; Tabs → pill tabs (active `bg-accent/10 text-fg`), keep ARIA/focus behaviour; AppCard → bay per mockup (44 px icon tile, name in Sen, one-line state, status light top-right, whole bay a link; red inset ring when the app has a critical finding); PageHeader h1 Sen 36 px; inputs 44 px, radius 12; dialogs and palette on `surface-raised` with radius 20; focus ring visible on all (`focus-visible:shadow-focus`). No raw hex in components (tokens only).
- [ ] Update component tests (class assertions where they exist; keep behaviour tests green); add a test that Button/Tabs/AppCard carry the focus-ring class.
- [ ] Suite/lint/build; commit.

## Wave 3 (after Tasks 3–5 are merged)

### Task 6: Home

**Files:** `src/pages/dashboard/components/{Dashboard,VerdictPanel,ResourcesStrip,ChainLine}.jsx` (rework), `src/components/box/AvadoDevice.jsx` (new), `src/pages/dashboard/components/ChainStatus.jsx` (new, replaces ChainLine on Home), tests.

**Requirements (mockups are the reference):** order: ChainStatus, hero (AvadoDevice left 380 px + gauges under it; verdict right), "Running on your AVADO" bays grid (4 cols ≥1280, 2 cols ≥640, 1 col below). AvadoDevice: the mockup's SVG as a component, prop `light: "ok"|"warning"|"critical"|"checking"` → ring/glow colour `success`/`warning`/`danger`/`fg-subtle`, glow pulses once on mount unless reduced motion; accessible label "Your AVADO box, status light <word>". Gauges: processor/memory/disk from `getDappnodeStats` with spec §6.0 ranges and "—" when missing. Verdict: status word line, Sen 54 px sentence (first finding's title or "Your AVADO is healthy."), why text, fix button(s), "N other checks passed · Checked hh:mm" line with "Check again"; "Checking your AVADO…" state while not ready (grey light). ChainStatus: simple = one line with status light and plain sentence (synced/syncing/behind/unknown from chainData + epochProgress), "Show details" switches to Advanced? — no: "Show details" expands the strip inline for this visit; advanced = strip from `epochProgress` (cells coloured seen=success, missing=success/40, now=accent, future=border), "N slots behind" / "In step with the network", peers from metrics; hidden entirely when no consensus client is installed; when metrics unavailable, advanced shows the simple line plus "Install monitoring to see the chain strip".
- [ ] Tests: device light per verdict; gauges ranges and "—"; ChainStatus simple/advanced/no-client/no-metrics; bays grid.
- [ ] Suite/lint/build; commit.

### Task 7: My DApps, app page, DappStore

**Files:** `src/pages/packages/components/{PackageList,AppPage,AppOverview,SetupFrame}.jsx`, `src/pages/installer/components/{InstallerHome,ManifestStore,StorePresentation,InstallerSinglePkg}.jsx`, tests.

**Requirements:** My DApps = list of bays (row layout of the bay component) keeping all controls (Open, Manage, restart with confirm, auto-update switch with pending state). App page header: large app icon, name in Sen, description, status light, version (Advanced only), Open / Restart / More; tabs via `tabsForMode` — in Simple only Overview + Setup; a deep link `?tab=logs` in Simple shows the Logs tab with an "Advanced page" note and a "Switch to advanced mode" link. DappStore: bays grid; Simple hides `SIMPLE_HIDDEN_STORE_CATEGORIES` and the IPFS-hash/custom install field; search still finds everything (results from hidden categories show with a small "Advanced" tag); `?category=` of a hidden category still works.
- [ ] Tests for mode behaviour (tabs, deep link note, store category filtering, search across hidden).
- [ ] Suite/lint/build; commit.

### Task 8: Staking setup, Help, System, Priority, others

**Files:** pages under `src/pages/{staking,troubleshoot,system,priority,devices}`, `src/components/NotFound.jsx`, `src/pages/packages/components/SetupFrame.jsx` (Remote Connect frame), tests.

**Requirements:** apply the new components and spacing; Help tiles become panels with icon tile + status light; System tabs pill style; System reached in Simple (deep link or finding link) shows the "Advanced page" note; Priority page restyled with the same panels (keep all billing logic untouched); NotFound in the new style; Remote Connect frame `surface` border radius 20. No logic changes.
- [ ] Update/extend tests where copy/structure changed; suite/lint/build; commit.

### Task 9: Palette and finding detail by mode

**Files:** `src/components/palette/{commands.js,CommandPalette.jsx}`, `src/health/rules/chain.js`, `src/components/health/FindingRow.jsx`, tests.

**Requirements:** palette adds "Switch to advanced mode" / "Switch to simple mode" and "Use light theme" / "Use dark theme" / "Match computer theme"; in Simple, action commands (restart, cleanup) and Advanced-only pages are hidden from results unless the query matches their exact label. Chain rules add `detail` (e.g. "Head slot 15 273 292, wall-clock slot 15 273 360 (68 behind)", "16 peers (Prometheus libp2p_peers)"); FindingRow shows `detail` in muted small text only in Advanced.
- [ ] Tests; suite/lint/build; commit.

## Wave 4

### Task 10: Sweep, browser pass, release 10.0.53 (controller)

- [ ] Grep for leftover raw hex / old classes in pages owners use; fix via one implementer if needed.
- [ ] Controller browser pass against the test box (production build via `vite preview` + cache-busting query): every page in light/dark × simple/advanced at 1440 and phone width.
- [ ] Final whole-branch review (Opus), one fix wave, scoped re-review.
- [ ] Merge upstream/master into the branch, bump 10.0.53, validate yarn.lock (parser + frozen install), push `10.0.53` to upstream, PR, CI green, merge commit to master, release, update on the test box via the DappStore, verify live.
