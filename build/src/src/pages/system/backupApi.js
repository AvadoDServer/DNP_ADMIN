/**
 * Encrypted backups to the owner's own USB disk or NAS (DAPPMANAGER 10.0.58
 * and newer; callers check canBackup first). The calls:
 *
 *   backupStatus()  -> { setUp, target, weekly, apps, last, lastSuccessAt, lastRestore, weeklyNote, job }
 *   backupTargets() -> { disks: [{ id, name, model, size, fsName, usable, reason }] }
 *   backupSetup({ target, passphrase, weekly }) -> status
 *   backupOptions({ weekly, apps: { name: { included, includeLarge } } }) -> status
 *   backupNow() -> { started }
 *   backupFind({ target }) -> { backups: [{ repo, boxName, thisBox, runs: [{ id, at, apps }] }] }
 *   backupRestore({ target, repo, run, passphrase, apps: [{ name, items }], confirmValidators }) -> { started }
 *
 * The passphrase is never logged here, never put in the redux store and
 * never in a toast. In mock mode (`yarn dev`) a fake USB disk is plugged in.
 */

export const PAGE_PATH = "/system/backup";
export const MIN_PASSPHRASE = 10;
export const MAX_PASSPHRASE = 256;
export const OLD_CORE_TEXT = "Your AVADO needs an update before it can make backups.";
export const LOST_TEXT = "The connection to your AVADO was lost. Reload the page and try again.";
export const FAILED_TEXT = "Something went wrong. Try again; if it keeps failing, contact AVADO support.";

const rpc = () => import("API/rpcMethods").then(m => m.default);
const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Same rules as the DAPPMANAGER; the first one broken, as a sentence */
export function passphraseProblem(p) {
  if (!p) return "Type a passphrase.";
  if (CONTROL.test(p)) return "The passphrase cannot contain line breaks or other control characters.";
  if ([...p].length < MIN_PASSPHRASE) return `The passphrase must have at least ${MIN_PASSPHRASE} characters.`;
  if ([...p].length > MAX_PASSPHRASE) return `The passphrase can have at most ${MAX_PASSPHRASE} characters.`;
  return null;
}

const NO_SUCH_CALL = /no_such_procedure|no such procedure|not registered/i;
const TRANSPORT_ERROR =
  /callee disconnected|wamp\.error\.(canceled|cancelled|timeout)|connection (is )?(not open|lost|closed)|session (object )?is not defined|timed? ?out/i;

export function errorText(e) {
  const msg = String((e && e.message) || e || "");
  if (NO_SUCH_CALL.test(msg)) return OLD_CORE_TEXT;
  if (TRANSPORT_ERROR.test(msg)) return LOST_TEXT;
  if (/^[A-Z0-9][^\n]{0,300}\.$/.test(msg)) return msg;
  return FAILED_TEXT;
}

/* ------------------------------ formatting ------------------------------ */

export function humanSize(bytes) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return "0 MB";
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function humanDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function targetName(t) {
  if (!t) return "";
  if (t.type === "usb") return [t.name, t.size ? humanSize(t.size) : null].filter(Boolean).join(", ");
  return `NAS ${t.host}/${t.share}${t.folder ? "/" + t.folder : ""}`;
}

/* ------------------------------ mock ------------------------------ */

const mock = {
  disks: [{ id: "64B2-1A2F", name: "SanDisk Ultra Fit", model: "SanDisk Ultra Fit", size: 64e9, fsName: "exFAT", usable: true }],
  settings: { setUp: false, target: null, weekly: false },
  apps: [
    {
      name: "vaultwarden.avado.dnp.dappnode.eth",
      title: "Vaultwarden",
      running: true,
      included: true,
      includeLarge: false,
      validator: false,
      hasLarge: false,
      items: [{ name: "data", label: "Passwords, accounts and settings", included: true, found: true }]
    },
    {
      name: "teku.avado.dnp.dappnode.eth",
      title: "Teku",
      running: true,
      included: true,
      includeLarge: false,
      validator: true,
      hasLarge: false,
      items: [{ name: "validator", label: "Validator keys, slashing protection and settings", validator: true, included: true, found: true }]
    },
    {
      name: "immich.avado.dnp.dappnode.eth",
      title: "Immich",
      running: true,
      included: true,
      includeLarge: false,
      validator: false,
      hasLarge: true,
      items: [
        { name: "database", label: "Albums, people and accounts", included: true, found: true },
        { name: "library", label: "Photos and videos", large: true, included: false, found: true }
      ]
    }
  ],
  last: null,
  lastSuccessAt: null,
  job: null,
  runs: []
};

function mockStatus() {
  return { ...mock.settings, apps: mock.apps, last: mock.last, lastSuccessAt: mock.lastSuccessAt, lastRestore: null, weeklyNote: null, job: mock.job };
}

function mockRun(kind, done) {
  mock.job = { kind, startedAt: Date.now(), step: "app", current: mock.apps[0].name, n: 1, total: mock.apps.length, percent: 0, done: false };
  let p = 0;
  const t = setInterval(() => {
    p += 0.25;
    mock.job = { ...mock.job, percent: p % 1, n: Math.min(mock.apps.length, 1 + Math.floor(p)), current: mock.apps[Math.min(mock.apps.length - 1, Math.floor(p))].name };
    if (p >= mock.apps.length) {
      clearInterval(t);
      mock.job = { ...mock.job, done: true, ok: true, step: "done" };
      done();
    }
  }, 400);
}

const MOCK = {
  backupStatus: () => delay(mockStatus(), 200),
  backupTargets: () => delay({ disks: mock.disks }, 400),
  backupSetup: ({ target, weekly }) =>
    delay(null, 800).then(() => {
      mock.settings = { setUp: true, weekly: weekly === true, target: { type: "usb", ...mock.disks.find(d => d.id === target.id) } };
      return mockStatus();
    }),
  backupOptions: ({ weekly, apps }) => {
    if (typeof weekly === "boolean") mock.settings.weekly = weekly;
    for (const [name, o] of Object.entries(apps || {})) {
      const a = mock.apps.find(x => x.name === name);
      if (!a) continue;
      if (typeof o.included === "boolean") a.included = o.included;
      if (typeof o.includeLarge === "boolean") a.includeLarge = o.includeLarge;
      a.items = a.items.map(i => ({ ...i, included: a.included && (!i.large || a.includeLarge) }));
    }
    return delay(mockStatus(), 200);
  },
  backupNow: () => {
    const at = new Date().toISOString();
    mockRun("backup", () => {
      mock.last = { kind: "backup", at, endedAt: new Date().toISOString(), ok: true, apps: mock.apps.filter(a => a.included).map(a => ({ name: a.name, title: a.title, ok: true, bytes: 3e6 })) };
      mock.lastSuccessAt = mock.last.endedAt;
      mock.runs.unshift({ id: at.replace(/[-:]/g, "").slice(0, 15).toLowerCase(), at, apps: mock.last.apps.map(a => ({ ...a, items: ["settings", "data"] })) });
    });
    return delay({ started: true }, 300);
  },
  backupFind: () => delay({ backups: [{ repo: "avado-1234abcd", boxName: "AVADO", thisBox: true, runs: mock.runs }] }, 600),
  backupRestore: ({ passphrase }) => {
    if (passphrase !== "correct horse battery") return delay(null, 600).then(() => Promise.reject(Error("The passphrase is wrong.")));
    mockRun("restore", () => {});
    return delay({ started: true }, 300);
  }
};

async function call(name, kwargs = {}) {
  try {
    if (import.meta.env.REACT_APP_MOCK_DATA) return await MOCK[name](kwargs);
    const api = await rpc();
    return await api[name](kwargs);
  } catch (e) {
    throw Error(errorText(e));
  }
}

export const getStatus = () => call("backupStatus");
export const getTargets = () => call("backupTargets");
export const setupBackup = kwargs => call("backupSetup", kwargs);
export const setOptions = kwargs => call("backupOptions", kwargs);
export const backupNow = () => call("backupNow");
export const findBackups = kwargs => call("backupFind", kwargs);
export const restoreBackup = kwargs => call("backupRestore", kwargs);

/** What the owner sees while a job runs: "Backing up Teku (2 of 3)" */
export function jobText(job, apps = []) {
  if (!job) return "";
  const title = (apps.find(a => a.name === job.current) || {}).title || (job.current || "").split(".")[0];
  if (job.step === "stopping") return "Stopping the apps…";
  if (job.step === "tidy") return "Tidying up old backups…";
  if (job.step === "start" || !job.current) return job.kind === "restore" ? "Starting the restore…" : "Starting the backup…";
  const verb = job.kind === "restore" ? "Restoring" : "Backing up";
  return `${verb} ${title}${job.total > 1 ? ` (${job.n} of ${job.total})` : ""}…`;
}

// Tests only
export function _mock() {
  return mock;
}
