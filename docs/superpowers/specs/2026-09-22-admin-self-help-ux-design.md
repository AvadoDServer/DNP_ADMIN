# AVADO Admin: self-help UX overhaul — design

Date: 2026-09-22 · Branch: `ux/self-help` (from `modernize/admin-ui`, released as 10.0.51) · Status: approved in conversation, spec awaiting review

## 1. Why

AVADO owners are mostly non-technical home stakers. Today the Admin tells them little about whether their node is healthy: Home shows CPU/memory/disk and truncated package cards, while real problems (Nimbus without an execution client) are only visible deep inside a package. Support requests cluster around six topics:

1. Validator setup (keys, fee recipient, which clients to pair)
2. Sync / "is my node OK?"
3. Missed attestations
4. Updates and versions
5. Access and network (my.ava.do, Wi-Fi, VPN, Remote Connect, ports)
6. Disk space

**Goal:** an owner can see at a glance whether their AVADO is healthy, and for each of the six topics can find out what is wrong and fix it without contacting support. When they do need support, they arrive with a diagnostics report. Priority Support becomes a step up, not a crutch.

**Success criteria**
- Home answers "is my node OK?" in one sentence and lists every open problem with a fix.
- Every finding says what is wrong, why it matters and what to do, in plain words.
- The six topics each have a guided path in Help.
- No page is blank, truncated or clipped at 360 px or 1440 px, in dark or light theme.
- Upgrading the Admin through the store cannot break a box: no change to the DAPPMANAGER, WAMP API or crossbar config.

## 2. Constraints

- **Admin-only release.** Only `admin.dnp.dappnode.eth` changes. No DAPPMANAGER, WAMP or crossbar change, no new WAMP calls, no security hardening. Everything uses data the Admin already receives.
- **Offline-tolerant.** Boxes can have no internet access. Fonts are bundled (`@fontsource`), not loaded from Google Fonts. External data (store updates via `rpc.ava.do`, docs links) degrades gracefully.
- **Existing stack.** React 18, react-router 5, redux + redux-saga + reselect, Vite 5, Tailwind 3.4 on the existing token system (`theme.css`). New UI uses `components/ui`. No new UI framework.
- **The packages' own wizards stay as they are.** They are iframes served by each package. We restyle the frame around them only.
- **Deferred:** "Send report to AVADO" for Priority subscribers needs a new signing action (`report`) in the DAPPMANAGER (`signPrioritySupportRequest.js:4` allows only `checkout` and `portal`). It ships with the next DAPPMANAGER release, not this one.

## 3. Information architecture

**Sidebar**, in order:

| Item | Route | Notes |
|---|---|---|
| Home | `/dashboard` (`/` redirects) | Health verdict, findings, resources, chain, apps |
| DappStore | `/installer` | Existing, restyled cards |
| My DApps | `/packages` | List + app page with tabs |
| Staking setup | `/staking` | New checklist |
| Remote Connect / Connect | unchanged | Empty state instead of error when missing |
| Priority | `/priority` | Existing |
| Help | `/help` (`/troubleshoot` redirects) | Troubleshooter, report, resources |
| System | `/system` | Sub-tabs: Overview · Updates · Storage · History |

The dead `home` page is removed; `/` redirects to `/dashboard`. `activity` moves to System → History. Links use lower-case routes (`/packages/...`, `/system/...`); the old `/Packages/...` and `/System/...` forms keep working through redirects.

**Top bar**: box identity, theme toggle, notifications, help. Every icon gets a visible label on ≥1024 px and a tooltip + `aria-label` below that. A **search field** (⌘K / Ctrl-K, `/` also focuses it) opens a command palette over pages, installed apps, store apps, help articles and actions ("Restart Nimbus", "Clean up disk", "Download diagnostics report").

## 4. Health checks engine

### 4.1 Shape

`src/health/` — pure, synchronous rule functions over a snapshot, plus one hook that builds the snapshot.

```js
// A finding
{
  id: "consensus-without-execution",       // stable, used as React key and for dismissals
  severity: "critical" | "warning" | "info",
  topic: "setup" | "sync" | "attestations" | "updates" | "access" | "storage" | "core",
  appId?: "nimbus.avado.dnp.dappnode.eth", // ties the finding to an app page
  title: "Nimbus has no execution client",
  why: "A consensus client needs an execution client to follow the chain. Until you install one, Nimbus cannot attest and your validators miss rewards.",
  fix: {
    kind: "action" | "link" | "steps",
    label: "Install an execution client",
    to?: "/installer?category=eth-staking",   // link
    action?: "restartPackage",                 // action, dispatched with appId
    steps?: ["…", "…"],                        // steps
  },
  learnMore?: "https://docs.ava.do/…",
  secondary?: { kind: "link", to, label },   // a second, quieter action (e.g. "See why in the logs")
  steps?: ["…"],                            // guided steps shown under the finding
  dismissable?: true,                        // info findings that may be hidden ("Hide")
}
```

```js
// The snapshot every check receives
{
  packages,        // dnpInstalled: id, name, state, running, version, isCore, volumes[{size}], manifest, autoupdate
  stats,           // getStats: cpu, memory, disk, diskTotal, diskUsed
  params,          // getParams: alertToOpenPorts, upnpAvailable, noNatLoopback, …
  diagnoses,       // troubleshoot selectors (session, DAPPMANAGER ping, IPFS, ports)
  chainData,       // requestChainData: per chain syncing + progress
  updates,         // store getUpdates → { [name]: latestVersion } | null when unreachable
  coreUpdate,      // services/coreUpdate selectors
  metrics,         // Prometheus results | null when monitoring is not installed or unreachable
  sources,         // { updates: "loading" | "ok" | "failed", metrics: "not-installed" | "ok" | "failed" }, read by store-unreachable
  now,             // Date.now(), injected for testability
}
```

`runChecks(snapshot) → Finding[]` runs every rule, drops `null`s, sorts by severity then topic. A rule that throws is caught, logged and skipped, so one bad rule cannot blank Home.

`useHealth()` builds the snapshot from redux selectors plus two async sources polled while the Admin is open: store updates (every 10 min) and Prometheus (every 60 s, only if `prometheus.avado.dappnode.eth` is installed and running). It returns `{ findings, verdict, loading, sources }`, where `sources` says which inputs were unavailable so the UI can say "Attestation checks need the monitoring package" rather than silently skipping.

**Verdict:** any critical → "Action required"; any warning → "Needs attention"; else "All good".

**Dismissals:** info findings can be dismissed ("Don't show again"), stored in `localStorage` per finding id. Critical and warning findings cannot be dismissed; they disappear when the condition clears.

### 4.2 Client roles

A table in `src/health/clients.js` maps AVADO package names to roles (execution / consensus / validator tooling / MEV / monitoring), network, and display facts used by checks and guidance: prune advice, Prometheus job name, typical disk footprint. Unknown packages have no role and are ignored by role-based checks. The table is built from the DappStore categories and the Prometheus job list in `AVADO-DNP-Prometheus`, and has a unit test that it covers every client the store lists under "ETH STAKING".

### 4.3 Rules

| Id | Topic | Severity | Condition | Fix |
|---|---|---|---|---|
| `app-stopped` | sync | critical if the app is a client, warning otherwise | installed non-core app with `state` exited/dead | Action: Start/Restart; link: Logs tab |
| `app-restarting` | sync | critical | `state` restarting | Link: Logs tab; steps |
| `core-app-down` | core | critical | a core package not running | Link: System |
| `consensus-without-execution` | setup | critical | a consensus client installed and no execution client on the same network | Link: DappStore filtered to execution clients |
| `execution-without-consensus` | setup | warning | the reverse | Link: DappStore filtered to consensus clients |
| `chain-syncing` | sync | info | chainData reports syncing | Progress shown; no action |
| `head-behind` | sync | warning | Prometheus `beacon_head_slot` more than 2 epochs (64 slots) behind the wall-clock slot | Steps: peers, execution client synced, restart |
| `low-peers` | sync | warning | beacon peers < 10 (Prometheus `libp2p_peers` or `beacon_peer_count`) | Steps: open ports, UPnP |
| `missed-attestations` | attestations | warning; critical if > 50% missed | increase of `validator_monitor_prev_epoch_on_chain_attester_miss_total` over 1 h > 0 | Steps: sync, peers, execution client, clock |
| `monitoring-missing` | attestations | info | consensus client installed, monitoring not installed | Link: install Grafana (pulls Prometheus + Node exporter) |
| `updates-available` | updates | warning | store reports newer versions for installed apps | Link: System → Updates |
| `core-update-available` | updates | warning | `getCoreUpdateAvailable` | Link: System → Updates |
| `autoupdate-off` | updates | info | a client app has auto-update off | Link: My DApps |
| `ports-closed` | access | warning | `params.alertToOpenPorts` | Steps: router port forwarding (with the app's P2P ports) |
| `no-upnp` | access | info | `!params.upnpAvailable` | Steps |
| `no-nat-loopback` | access | info | `params.noNatLoopback` | Explanation of reaching the box from inside the LAN |
| `remote-access-missing` | access | info | neither Remote Connect nor VPN installed | Link: DappStore |
| `disk-high` | storage | warning ≥ 80 %, critical ≥ 90 % | `stats.disk` | Link: System → Storage; action: Clean up unused images |
| `diagnose-failed` | core | warning | any failing item from the Admin's existing diagnoses (`pages/troubleshoot/selectors.getDiagnoses`: DAPPMANAGER connected, IPFS resolves, ports) other than disk, which `disk-high` covers | The diagnose's own solutions as steps |
| `store-unreachable` | updates | info | store updates fetch failed | "Can't check for updates: your AVADO can't reach the internet" |

Metric names are verified against the test box (head slot and peers exist today); `missed-attestations` is tested against fixtures because the test box has no validators. If a metric is absent the rule returns nothing and `sources` records why.

## 5. Visual design

### 5.1 Direction

The Admin is an instrument panel for a machine that sits in someone's home and earns them money. It should feel **calm when things are fine and unmistakable when they are not**. One element is loud: the **health verdict**. Everything else is quiet, dense enough to scan, and consistent.

Brand continuity with the new www.ava.do: the same family (ink, navy, tide, signal) and the **Sen** typeface for display text, so the website and the box feel like one product. Inter stays for body and data because it is excellent at small sizes and tabular numbers.

### 5.2 Tokens

Existing `theme.css` stays the single source; values change and three tokens are added.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `#070C18` (ink, slightly lifted) | `#F3F5F9` | canvas |
| `--surface` | `#0F1729` | `#FFFFFF` | panels |
| `--surface-raised` | `#16203A` | `#FFFFFF` + shadow | popovers, palette |
| `--border` | `#223053` | `#DCE2EC` | hairlines |
| `--fg` / `--fg-muted` | `#EDF2FA` / `#9AA7C0` | `#0E1830` / `#4A5773` | text |
| `--accent` (signal) | `#5085F5` | `#2F6BE8` | actions, focus, links |
| `--brand` (tide) *new* | `#7ACBC7` | `#2E8F8A` | brand moments: healthy verdict, active nav, logo mark |
| `--success` | `#3DCB8A` | `#16895A` | running, passed checks |
| `--warning` | `#F2B84B` | `#A86A00` | needs attention |
| `--danger` | `#F26464` | `#C62F2F` | action required, stopped |
| `--verdict-ok-bg` *new* | tide at 10 % over surface | tide at 12 % over white | verdict band, healthy |
| `--verdict-warn-bg` / `--verdict-crit-bg` *new* | warning / danger at 10 % | at 12 % | verdict band |

Every text/background pair is checked against WCAG AA (4.5:1 body, 3:1 large text and UI). The light-theme status colours are darkened for that reason.

### 5.3 Type

- **Sen** 600/700: page titles, the verdict sentence, section titles. Bundled via `@fontsource/sen`.
- **Inter** 400/500/600: everything else. Bundled via `@fontsource/inter`, replacing the Google Fonts `@import` in `index.css`.
- **JetBrains Mono**: logs, versions, IDs only. Bundled.
- Scale (rem): 0.75 · 0.8125 · 0.875 (body) · 1 · 1.25 · 1.5 · 2 (page title) · 2.5 (verdict on ≥ 768 px). Line height 1.5 for body, 1.2 for display. Numbers use `font-variant-numeric: tabular-nums`.
- Sentence case everywhere. No all-caps labels (the current `STATUS / NAME / OPEN` table headers and `ETH STAKING` section labels become sentence case).

### 5.4 Layout and components

- Content column max 72 rem (as today), 16 px gutters on phones, 32 px on desktop. Sidebar collapses to a bottom sheet menu under 1024 px.
- **Fewer boxes.** Panels are used for groups that act as one thing (the verdict, the resources strip, an app). Lists (findings, apps on My DApps, updates, history) are rows with hairline dividers inside one panel, not a grid of identical cards.
- Radius: 14 px for panels, 10 px for controls, full for status pills. Shadows only on floating surfaces (palette, menus, modals).
- **Status pill:** dot + word, colour from status tokens, the same component everywhere (Running, Stopped, Crashed, Restarting, Updating, Needs setup, Update available).
- **App identity:** avatar 40 px with 10 px radius. When the manifest avatar is the generic AVADO placeholder (known IPFS hashes), render a monogram tile (first letters of the title on a colour derived from the app's role) so apps are distinguishable.
- **Focus:** 2 px `--accent` ring with 2 px offset on every interactive element. Motion: 150–220 ms ease-out on state changes; the verdict's status dot pulses once on load when not healthy; `prefers-reduced-motion` disables both.

### 5.5 Home

```
Home                                                    [Search ⌘K]
┌───────────────────────────────────────────────────────────────┐
│ ● Action required                                             │  ← verdict band, tinted by severity,
│ Nimbus can't attest: it has no execution client.              │    Sen 2.5rem sentence = worst finding
│                                                               │
│ ✕  Nimbus has no execution client               [Install one] │  ← findings rows (max 5, "Show all 7")
│    A consensus client needs an execution client… Why ▸        │
│ !  3 app updates are available                  [Review]      │
│ i  Install monitoring to check missed attestations  [Install] │
│                                               Checked 20:41 ↻ │
└───────────────────────────────────────────────────────────────┘
 CPU ▁▂▁ 4 %     Memory 6.6 of 62 GB     Disk 0.01 of 3.6 TB     ← one quiet resources strip
 Ethereum mainnet  ● Synced · 50 peers · head 15 273 229         ← only when a client is installed
 Your apps                                            [DappStore]
 ┌──────────────────────────────┐ ┌──────────────────────────────┐
 │ [N] Nimbus Consensus Client  │ │ [G] Grafana                  │
 │ Beacon chain and validator   │ │ Monitoring dashboards        │
 │ ● Running  ▲ Needs setup     │ │ ● Running  v0.0.4            │
 │ Open ▸                  ⋯    │ │ Open dashboards ▸       ⋯    │
 └──────────────────────────────┘ └──────────────────────────────┘
```

Healthy state: the band is tide-tinted, the sentence reads "All good. Your AVADO is healthy.", and below it a single line "12 checks passed · Checked 20:41 · See all". Empty state (no apps): "Your AVADO is ready. Start with Staking setup or browse the DappStore."

### 5.6 App page

Header: avatar, full title, description, status pill, version, update badge, and primary actions (Open, Restart; overflow menu: Stop, Reset, Remove). Tabs: **Overview · Setup · Logs · Settings · Files**. Setup exists only when the app has a wizard; the wizard iframe sits in a dark frame with a thin toolbar ("Setup — provided by Nimbus · Open in new tab"). Overview shows that app's findings first, then details (ports, volumes with size, links, dependencies).

### 5.7 Help

Topic grid of six tiles (icon, topic, one-line "for when…"), each tile showing a live status dot from its checks. A tile opens a guided page: live checks for that topic at the top, then numbered steps with the relevant actions inline, then "Still stuck?" with the report and contact options (Priority subscribers see their faster channel). Below the grid: "Download diagnostics report", "Copy report", "Email support" (a `mailto:` with the report summary in the body; mail clients cap URL length, so the body holds the verdict and failing checks and asks the user to attach the downloaded full report), and community resources (docs, YouTube, Telegram).

**Diagnostics report**: plain text containing Admin and core versions, box resources, all check results, each installed app's name/version/state/disk use, chain sync state, and the last 20 activity-log entries. It never contains env values, keys, logs or IP addresses beyond the internal one. It is shown to the user before it is copied or sent.

### 5.8 Staking setup

A vertical checklist of six steps, each with state (done / to do / optional), a sentence on why, and the action. Steps 1, 2, 5, 6 are detected from installed apps; 3 (import keys) and 4 (fee recipient) deep-link into the consensus client's Setup tab and are ticked by the user (stored in `localStorage`, per consensus client). A network note explains mainnet vs. testnet choices only if more than one network's clients are installed.

### 5.9 System

- **Updates:** list of apps with newer versions (current → latest, Update button that goes to the app's store page), then the core update block with its existing flow and a warning not to power off during it.
- **Storage:** disk bar, then per-app usage rows sorted by size (from `volumes[].size`), each with the role's prune guidance; "Clean up unused images" action with its existing confirmation.
- **History:** the activity log as readable rows (time, action, app, result), filterable by app.

## 6. Bug fixes in scope

- Unknown routes (for example `/#/support`) render an empty page → a "Page not found" screen with links to Home and Help, and `/support` redirects to `/help`.
- Hardcoded "Online" badge on Home → driven by the WAMP session state.
- Auto-update switch passes `manifest` instead of the package to `getAutoUpdateState` (`PackageList.jsx:197-199`).
- `/Packages/...` and `/System/...` route casing.
- Dead `/` Home page.
- `shortDescription` unused → used for card subtitles, falling back to the first sentence of `description`.
- Status badge knows only running/exited → shared status pill with all states.
- PackageList mutates redux objects (`p.title = …`) → derived data via selectors.
- Remote Connect / VPN missing → empty state with an install link instead of a red ✕.

## 7. Testing

- **Unit (Vitest + Testing Library, added as dev dependencies):** every rule with passing and failing fixtures; `runChecks` ordering and error isolation; client-role table coverage; report builder (asserts no env values or secrets); verdict derivation.
- **Build:** `vite build` clean, no new console errors.
- **Browser verification** against the test box (local dev server pointed at the box's WAMP, then the released image): every page in dark and light at 360, 768 and 1440 px; findings appear for the box's real state (Nimbus without execution client); actions work (restart, clean up, links); Help report contents.
- **Release:** ADMIN through staging to the test box, upgrade from 10.0.51 verified, then production when the owner decides.

## 8. Out of scope

- Changes to package wizards themselves.
- New DAPPMANAGER calls or WAMP changes, including the signed "Send report to AVADO".
- Per-container CPU/memory, uptime or restart counts (not exposed today).
- Detecting fee recipient or loaded keys automatically (needs package APIs).
