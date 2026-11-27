import { useEffect, useState } from "react";

/**
 * Box temperatures for Home (DAPPMANAGER 10.0.62 getTemperatures; callers
 * check canGetTemperatures first, so an older core never gets the call).
 *
 *   getTemperatures() -> { sensors: [{ chip, device, label, celsius, high, crit }], readAt }
 *
 * The DAPPMANAGER returns every hwmon sensor; pickTemperatures chooses what
 * Home shows: the processor, each disk, and memory when it has a sensor.
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) the call is served from
 * mockTemperatures in src/mockState.js; `?mock=hot` shows a box running hot
 * (ticket-0932: processor 90 °C one minute after boot).
 */

export const POLL_MS = 30 * 1000;
export const HOT_HINT = "Running hot: keep the box in open air, with space underneath and around it.";

// Processor: DAppNode's CPU temperature gauge uses the same marks (warning
// 85 °C, danger 95 °C); mini PCs throttle and some shut down above ~100 °C.
const PROCESSOR = { warn: 85, crit: 95 };
// NVMe drives without a usable mark of their own: most consumer drives start
// to slow down from about 70 °C.
const DISK = { warn: 70, crit: 80 };
// DDR5 memory sensors (spd5118): JEDEC's normal range ends at 85 °C.
const MEMORY = { warn: 80, crit: 90 };

// Processor sensors, most trusted first: Tdie is the real die temperature on
// AMD; Tctl can carry a fan-control offset and is used when it is all there is.
const CPU_PICKS = [
  ["k10temp", "Tdie"],
  ["k10temp", "Tctl"],
  ["zenpower", "Tdie"],
  ["zenpower", "Tctl"],
  ["coretemp", "Package id 0"],
  ["k10temp", null],
  ["zenpower", null],
  ["cpu_thermal", null],
];

const DISK_CHIPS = ["nvme", "drivetemp"];
const MEMORY_CHIPS = ["spd5118", "jc42"];

const isReading = s => s && typeof s.celsius === "number" && Number.isFinite(s.celsius);

function pickProcessor(sensors) {
  for (const [chip, label] of CPU_PICKS) {
    const found = sensors.find(s => s.chip === chip && (label === null || s.label === label));
    if (found) return found;
  }
  // Intel without a package sensor: the hottest core
  const cores = sensors.filter(s => s.chip === "coretemp");
  return cores.length ? cores.reduce((a, b) => (b.celsius > a.celsius ? b : a)) : null;
}

// One reading per disk: the drive's overall ("Composite") temperature, or its
// first sensor when it has no such label. Sorted by device (PCI address), the
// order `sensors` lists them in.
function pickDisks(sensors) {
  const byDevice = new Map();
  sensors
    .filter(s => DISK_CHIPS.includes(s.chip))
    .forEach((s, i) => {
      const key = s.device || `#${i}`;
      const current = byDevice.get(key);
      if (!current || (s.label === "Composite" && current.label !== "Composite")) byDevice.set(key, s);
    });
  return [...byDevice.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, s]) => s);
}

// A drive's own "too hot" mark when it looks sane; some report 0 or 117 °C
function diskMarks(s) {
  const high = typeof s.high === "number" && s.high >= 50 && s.high <= 95 ? s.high : null;
  if (high === null) return DISK;
  const crit = typeof s.crit === "number" && s.crit > high && s.crit <= 110 ? s.crit : high + 10;
  return { warn: high, crit };
}

function toneFor(celsius, { warn, crit }) {
  if (celsius >= crit) return "crit";
  if (celsius >= warn) return "warn";
  return "ok";
}

/**
 * @param {Array} sensors getTemperatures' sensors
 * @returns {Array} [{ id, label, celsius, tone: "ok" | "warn" | "crit" }]
 *   processor first, then the disks ("Disk", or "Disk 1", "Disk 2" when there
 *   are several), then memory; [] when nothing is known
 */
export function pickTemperatures(sensors) {
  const list = (Array.isArray(sensors) ? sensors : []).filter(isReading);
  const rows = [];

  const cpu = pickProcessor(list);
  if (cpu) rows.push({ id: "processor", label: "Processor", celsius: cpu.celsius, tone: toneFor(cpu.celsius, PROCESSOR) });

  const disks = pickDisks(list);
  disks.forEach((s, i) => {
    rows.push({
      id: `disk-${i + 1}`,
      label: disks.length > 1 ? `Disk ${i + 1}` : "Disk",
      celsius: s.celsius,
      tone: toneFor(s.celsius, diskMarks(s)),
    });
  });

  // Several memory sticks: the hottest one speaks for all
  const memory = list.filter(s => MEMORY_CHIPS.includes(s.chip));
  if (memory.length) {
    const hottest = memory.reduce((a, b) => (b.celsius > a.celsius ? b : a));
    rows.push({ id: "memory", label: "Memory", celsius: hottest.celsius, tone: toneFor(hottest.celsius, MEMORY) });
  }
  return rows;
}

export const formatCelsius = c => `${Math.round(c)} °C`;

/* ---------------- data ---------------- */

// Loaded on first use: API/rpcMethods brings the WAMP session and the whole
// redux store with it, which the dashboard tests must not import.
const rpc = () => import("API/rpcMethods").then(m => m.default);

export function getTemperatures() {
  if (import.meta.env.REACT_APP_MOCK_DATA) {
    return import("../../mockState").then(m => m.mockTemperatures(m.mockScenario()));
  }
  return rpc().then(api => api.getTemperatures());
}

/**
 * getTemperatures' sensors every POLL_MS while `allowed` and the tab is shown,
 * and at once when the tab is shown again. null until the first answer (and
 * while not allowed); a failed read keeps the last answer.
 */
export function useTemperatures(allowed, fetchImpl = getTemperatures) {
  const [sensors, setSensors] = useState(null);
  useEffect(() => {
    if (!allowed) {
      setSensors(null);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      Promise.resolve()
        .then(() => fetchImpl())
        .then(
          res => {
            if (!cancelled) setSensors(res && Array.isArray(res.sensors) ? res.sensors : []);
          },
          e => console.debug(`getTemperatures failed: ${e && e.message}`)
        );
    };
    load();
    const t = setInterval(load, POLL_MS);
    const onVisible = () => typeof document !== "undefined" && !document.hidden && load();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    };
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  return sensors;
}
