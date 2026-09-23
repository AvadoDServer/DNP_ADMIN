# AVADO Admin: visual redesign, Simple/Advanced modes and box readings — design

Date: 2026-09-23 · Branch: `ux/visual` (from `ux/self-help`, released as 10.0.52) · Target release: 10.0.53 · Status: approved 2026-09-23 with the change in §6.0 (box readings deferred)

Approved mockups: `mockups/home-light-simple.dc.html`, `mockups/home-dark-advanced.dc.html` (also on the design canvas https://claude.ai/artifact/BWBDgYB5DE93LZdP2BVt7u).

## 1. Why

10.0.52 fixed what the Admin says; it still looks like the old Admin. The owner chose a new visual direction ("Appliance": the box and its status light are the hero), kept the familiar left sidebar, wants B's chain strip, both light and dark themes, and — because owners are mostly non-technical — a **Simple mode** by default with an **Advanced mode** for experienced users. Home also gains the box's key readings (temperatures, load, space), which must **work on every AVADO in the field**, not just the new test box: most owners run the older Intel i7 10th-gen AVADO; the test box is a newer Ryzen 9 PRO 8945HS on kernel 5.10.

**Success criteria**
- Home matches the approved mockups in both themes and both modes.
- Every page uses the new visual system (no leftover old-style boxes, all-caps labels or Bootstrap look on pages owners use).
- Simple mode is the default and hides everything an owner doesn't need day to day; Advanced shows the rest. Nothing is lost: every feature is reachable in Advanced.
- On any AVADO, Home shows correct readings or clearly says what isn't available and why — never a wrong number, never a blank or broken tile, never a crash.
- Admin-only release: no DAPPMANAGER, WAMP, crossbar or OS change; no kernel modules loaded automatically.

## 2. Constraints (carried over)

Admin-only release; offline-tolerant (fonts bundled); existing React 18 / Vite 5 / Tailwind 3.4 stack and `components/ui`; package wizards unchanged; the upgrade must not brick a box; verify on the test box before release. Additionally:
- **Hardware variety:** Intel (coretemp) and AMD (k10temp) CPUs, NVMe and SATA disks, kernels that report some sensors and not others.
- **Access variety:** the Admin is opened as my.ava.do, by IP, over Remote Connect or VPN — metrics must work in all of them.
- **Careful self-repair:** automatic actions are limited to retrying, reconnecting and falling back. Anything that restarts, installs or changes the box stays one click for the owner. Validator clients are never touched automatically.

## 3. Visual system

**Direction:** "Appliance". Calm and physical: the owner's AVADO drawn as a device with a status light is the one loud element on Home; everything else is quiet, generous and readable.

**Type:** Sen (display: page titles, the verdict sentence, section titles, big numbers) and Public Sans (body, labels, data; replaces Inter). Both bundled via `@fontsource`. Scale (rem): 0.8125 · 0.875 · 1 (body 16 px, up from 14) · 1.125 · 1.375 · 1.75 · 2.25 · 3.375 (Home verdict). Sentence case everywhere.

**Tokens** (existing `theme.css` channel format; values replace the current ones):

| Token | Light | Dark |
|---|---|---|
| `--bg` canvas | `#EEF1F5` porcelain | `#0A1530` navy |
| `--surface` panels | `#FFFFFF` | `#13213F` |
| `--surface-raised` | `#FFFFFF` + shadow | `#1A2B4F` |
| `--chrome` top bar | `#F6F8FB` | `#0D1A36` |
| `--border` | `#DCE2EC` | `#22385F` |
| `--fg` / `--fg-muted` | `#0E1830` / `#5A6883` | `#EAF0FA` / `#9DB0D3` |
| `--accent` (primary buttons, active nav, links) | `#0B2C71` AVADO navy | `#7ACBC7` tide (dark text on it) |
| `--brand` tide | `#2E9E97` | `#5CC3BC` |
| `--ok` / `--warn` / `--crit` status lights | `#2E9E97` / `#C77C00` / `#E5483F` | `#5CC3BC` / `#F2B84B` / `#FF7A6B` |

Every text/background pair is AA (contrast test extended to the new tokens). The Theme menu becomes a Light / Dark / Match computer switch (default: match computer).

**Shape:** panels radius 20 px, tiles 18 px, controls 12 px, pills full. No borders on light panels (a 1 px bottom shadow instead); hairline borders in dark. Primary buttons are pills (navy in light, tide in dark).

**Components restyled:** Button, Card/panel, StatusPill (becomes a "status light": dot + word), Tabs (pill tabs), FindingRow, AppCard (becomes an app "bay": icon, name, one-line state, status light), Table rows, inputs, dialogs, toasts, the command palette, empty and loading states.

## 4. Layout

**Sidebar** (kept where owners expect it): 248 px, icons + labels, active item is a filled pill. Footer holds the box name, the Light/Dark switch, the Simple/Advanced switch and the version. Under 1024 px it becomes the existing off-canvas drawer.
**Top bar:** search (⌘K) and notifications only; theme and the old chain/identity dropdowns move into the sidebar footer and the chain strip.

**Home** (per mockups):
1. Chain status — Simple: one line ("Following Ethereum — Nimbus is keeping up with the network", or the problem in plain words); Advanced: the epoch strip (32 slots, seen / not yet seen / now), how many slots behind, peers.
2. Hero — the AVADO device drawing with its status light in the verdict colour (green / amber / red; grey while checking), the verdict sentence, the explanation and the fix button, "N other checks passed".
3. Box readings (section 6) next to the device.
4. "Running on your AVADO" — app bays.

**Other pages** get the same system: My DApps (bays in a list), app page (header with status light; pill tabs), DappStore (bays grid), Staking setup, Help, System, Priority, Remote Connect frame, not-found, dialogs.

## 5. Simple and Advanced modes

A persistent preference (localStorage `avado.mode`, default `simple`), switched in the sidebar footer and from ⌘K ("Switch to advanced mode").

| Area | Simple | Advanced |
|---|---|---|
| Sidebar | Home, DappStore, My DApps, Staking setup, Help, Priority | + Remote Connect, System |
| Chain status | One plain line | Epoch strip, slots behind, peers |
| Box readings | Processor, memory, disk space | Same, plus "Open in Grafana" when monitoring is installed |
| App page tabs | Overview, Setup | + Logs, Settings, Files |
| Findings | Plain fix | + technical detail line (slot counts, peers, metric names) |
| DappStore | Curated categories | All categories incl. testnets, "The Lab", custom IPFS hash box |
| Command palette | Pages, apps, help | + actions (restart, cleanup) |

Rules: Simple never hides a **problem** — a finding that needs an Advanced page (e.g. System → Storage) links there and the link works in Simple mode too. Deep links to Advanced-only pages open them (with a small "Advanced page" note), they are never 404s. Remote Connect stays in Simple's sidebar if Remote Connect is installed (it's how people reach the box from away).

## 6. Box readings

### 6.0 Decision (2026-09-23)
Temperature and extended readings on Home are **deferred**: there is no older (Intel i7 10th-gen) AVADO on staging to verify them on the hardware most owners have. This release ships **no sensor reader and no temperature, network, disk-activity or uptime readings**, and none of the `cpu-hot`, `disk-hot` or `sensor-reader-stale` checks. The design below the line is kept for the follow-up release.

**In this release:**
- Home shows the three readings every box already reports through DAPPMANAGER `getStats` — processor, memory, disk space — as gauges under the device drawing (as in the mockups), coloured by range (processor < 80 / 80–95 / ≥ 95 %, memory < 85 / 85–95 / ≥ 95 %, disk space < 80 / 80–90 / ≥ 90 %). Missing values show "—", never 0.
- **Prometheus proxy** (6.1 tier 2) ships, because the chain strip and the existing sync/peers/attestation checks use it: nginx `location /metrics-api/` → `http://prometheus.my.ava.do:9090/api/v1/`, GET only, `query` and `query_range` only, Docker DNS resolver `127.0.0.11` with short validity. The UI tries the proxy first, then the direct URL, then treats metrics as unavailable (existing `metrics-unavailable` finding).
- **`monitoring-stopped`** check (6.3) ships.

### Deferred design (next release, needs an old box on staging)

### 6.1 Sources (layered; each reading uses the best available)

| Tier | Source | Available | Gives |
|---|---|---|---|
| 0 | DAPPMANAGER `getStats` (existing WAMP) | Every box | CPU %, memory, disk space |
| 1 | **Admin's own sensor reader** (new, inside the Admin container) | Every box whose kernel reports the sensor | CPU temperature, disk temperature, other hwmon/thermal sensors |
| 2 | **Prometheus via the Admin's own web server** (new proxy) | Boxes with the monitoring package | Trends, network, disk activity, uptime, chain strip, peers, attestations |

**Tier 1 — sensor reader.** The Admin container can read the host's `/sys/class/hwmon` and `/sys/class/thermal` (verified on the test box: NVMe 34.9 °C). A small read-only script started from `entrypoint.sh` (background, low priority, killed by the existing TERM trap) writes `/usr/www/adminui/sensors.json` every 15 s: `{ updatedAt, sensors: [{ chip, label, input, max, crit }] }`. It only reads files; if `/sys` is unreadable it writes `{ available: false, reason }`; it can never stop nginx or the Admin. The UI normalises chips:
- CPU: `coretemp` "Package id 0" (Intel — most AVADOs), `k10temp` Tctl/Tdie (AMD, kernel ≥ 6.x for Ryzen 8000), `zenpower`, thermal zone `x86_pkg_temp`; else none.
- Disk: `nvme` "Composite", `drivetemp` (SATA, only if the kernel module is already loaded).
- Discard implausible values (≤ 0 °C, ≥ 150 °C) and constant ACPI zones that report 0 (seen on the test box).

**Tier 2 — Prometheus proxy.** nginx gains a read-only `location /metrics-api/` → `http://prometheus.my.ava.do:9090/api/v1/` (Docker DNS `127.0.0.11`, `resolver` with short validity so it recovers when Prometheus is installed later), GET only, only `query` and `query_range`. The UI calls the same-origin proxy first, so metrics work via my.ava.do, IP, Remote Connect and VPN, with no CORS; on failure it falls back to the direct URL, then to tier 0/1.

### 6.2 Readings shown

| Reading | Simple | Advanced | Source order | Ranges (ok / warn / crit) |
|---|---|---|---|---|
| CPU temperature | ✓ | ✓ + trend | T1, T2 | < 80 / 80–90 / ≥ 90 °C (or chip's `max`/`crit` when reported) |
| Disk temperature | ✓ | ✓ + trend | T1, T2 | < 60 / 60–75 / ≥ 75 °C (or drive's `max`/`crit`) |
| Processor use | ✓ | ✓ + trend | T0, T2 | < 80 / 80–95 / ≥ 95 % sustained |
| Memory | ✓ | ✓ + trend | T0, T2 | < 85 / 85–95 / ≥ 95 % |
| Disk space | ✓ (in Simple instead of CPU temp when CPU temp is missing) | ✓ | T0 | < 80 / 80–90 / ≥ 90 % |
| Network in/out | — | ✓ | T2 | — |
| Disk activity | — | ✓ | T2 | — |
| Uptime | — | ✓ | T2, T0 | — |

A reading that no source provides is **not shown** in Simple mode; in Advanced it shows "Not reported by this box" with a one-line reason (e.g. "This box's system software doesn't report the CPU temperature"). No reading ever shows a stale value: data older than 2 minutes (T1) or 5 minutes (T2) is treated as missing and shown as "last seen hh:mm".

### 6.3 New checks
- `cpu-hot` (warning ≥ 80 °C sustained 5 min via T2, or two consecutive T1 readings; critical ≥ 90): airflow/placement advice.
- `disk-hot` (warning ≥ 70 °C, critical ≥ the drive's reported `max`, else 80): same.
- `sensor-reader-stale` (info): sensor file not updated for 2 minutes → "Restart the Admin" one click.
- `monitoring-stopped` (warning, replaces nothing): Prometheus installed but its container isn't running → "Restart monitoring" one click (restarts Prometheus only).

### 6.4 Self-repair (automatic, safe only)
- Retries with backoff for WAMP stats, sensors and Prometheus; instant fallback to the next source, so tiles never blank.
- Proxy → direct URL → lower tier fallback, remembered per session.
- The sensor reader restarts itself if it exits (a loop in the entrypoint).
- Nothing is restarted, installed or loaded automatically; one-click fixes above are the owner's choice. No kernel modules are loaded (`drivetemp`, `k10temp`); CPU temperature on the newest AVADO models needs a kernel update — a separate, OS-level project, out of scope here.

## 7. Compatibility and testing

- **Hardware fixtures (deferred with §6):** unit tests for sensor normalisation with real layouts: Intel coretemp (i7-10710U-style: Package id 0 + Core 0–5), AMD k10temp (Tctl, Tccd1), Ryzen 8000 on 5.10 (no CPU sensor), NVMe Composite, SATA with/without drivetemp, bogus ACPI zones, empty `/sys`.
- **Access paths:** proxy tested from my.ava.do, the box IP and a Remote Connect session on the test box.
- **Old boxes (deferred with §6):** the owner is asked for access to one Intel i7 10th-gen AVADO (staging-flagged) for a read-only check of the sensor file before production. If none is available, production release waits on fixtures + test box only, and the reading shows "Not reported" rather than guessing.
- **Modes and themes:** every page checked in light/dark × simple/advanced at 360 / 768 / 1440 px on the test box.
- Existing 224 tests stay green; new tests for sensors, proxy fallback logic, modes (sidebar items, tabs, deep links), themes (contrast), readings (ranges, stale data).

## 8. Out of scope
- Kernel/OS updates or loading kernel modules (CPU temperature on the newest Ryzen boxes, SATA drivetemp auto-load).
- Changes to package wizards, DAPPMANAGER or WAMP.
- Embedding Grafana panels (Advanced links to Grafana instead).
