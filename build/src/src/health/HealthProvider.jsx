import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappnodeStats, getDappnodeParams, getDappmanagerVersionData } from "services/dappnodeStatus/selectors";
import { getChainData } from "services/chainData/selectors";
import { getCoreUpdateAvailable } from "services/coreUpdate/selectors";
import { getDiagnoses } from "pages/troubleshoot/selectors";
import { getIsLoaded, getLoadingError } from "services/loadingStatus/selectors";
import { fetchStore } from "services/store/fetchStore";
import { computeUpdates } from "services/store/updates";
import { fetchMetrics, fetchDiskTrend } from "./prometheus";
import { fetchFeeRecipients, VALIDATOR_CLIENTS } from "./feeRecipients";
import { trackUpdateAges } from "./updateAges";
import { CARE_PACKAGE, careFindingsFromStatus, fetchCareStatus, mergeCareFindings } from "./careFindings";
import { PROMETHEUS_PACKAGE, canFindLostData, canResetIpfsData, canGetDiagnostics } from "./clients";
import { listLostData } from "pages/packages/lostDataApi";
import { getIpfsHealth, noteIpfsHealth, ipfsResetState, subscribeIpfsReset } from "pages/system/ipfsResetApi";
import { getDiagnostics, LIGHT as LIGHT_DIAGNOSTICS } from "pages/troubleshoot/diagnosticsApi";
import { runChecksDetailed, verdictOf, SEVERITIES, TOPICS } from "./engine";
import { diskForecast } from "./rules/storage";
import { IPFS_RESULT_NOTE_MS } from "./rules/ipfs";

const rankOf = (list, v) => (list.indexOf(v) === -1 ? list.length : list.indexOf(v));
// Same order as the engine's own list, for findings merged in from AVADO Care.
const sortFindings = list =>
  [...list].sort(
    (a, b) =>
      rankOf(SEVERITIES, a.severity) - rankOf(SEVERITIES, b.severity) ||
      rankOf(TOPICS, a.topic) - rankOf(TOPICS, b.topic) ||
      String(a.title).localeCompare(String(b.title))
  );
import { ALL_RULES } from "./rules";
import { isDismissed, dismiss as persistDismiss, undismissAll as persistUndismissAll } from "./dismissals";

const STORE_INTERVAL = 10 * 60 * 1000;
const METRICS_INTERVAL = 60 * 1000;
// The disk trend moves over days; its 7-day queries are the heaviest ones.
const DISK_TREND_INTERVAL = 10 * 60 * 1000;
const DISK_TREND_KEEP_MS = 60 * 60 * 1000;
const NODEID_TIMEOUT_MS = 20 * 1000;
const FEE_RECIPIENT_INTERVAL = 10 * 60 * 1000;
const CARE_STATUS_INTERVAL = 10 * 60 * 1000;
const LOST_DATA_INTERVAL = 10 * 60 * 1000;
// Home asks again on every visit, but not when the last scan started less
// than this long ago (opening the Admin on Home would otherwise scan twice).
const LOST_DATA_MIN_GAP_MS = 30 * 1000;
// getIpfsHealth is one `docker inspect`; often enough that a crash loop
// shows within minutes and the DAPPMANAGER can count restarts per hour.
const IPFS_HEALTH_INTERVAL = 2 * 60 * 1000;
// getDiagnostics with containers and their programs only (one docker inspect
// and a supervisorctl status per app): often enough that a program that
// stopped inside a running container shows within a minute or two.
const DIAGNOSTICS_INTERVAL = 60 * 1000;
const UPDATE_AGES_KEY = "avado.updateAges";

// When each pending update was first seen, kept in this browser so the
// "update blocked" check (48 h) survives reloads. Storage errors (private
// mode, blocked storage) only mean the clock starts again on reload.
function readUpdateAges() {
  try {
    const v = JSON.parse(localStorage.getItem(UPDATE_AGES_KEY) || "null");
    return v && typeof v === "object" ? v : null;
  } catch (e) {
    return null;
  }
}
function writeUpdateAges(ages) {
  try {
    localStorage.setItem(UPDATE_AGES_KEY, JSON.stringify(ages || {}));
  } catch (e) {
    // ignore
  }
}

// "failed" when Prometheus didn't answer at all (fetchMetrics returned null),
// "partial" when only some queries failed (their keys are null), else "ok".
function metricsStatus(data) {
  if (!data) return "failed";
  return Object.values(data).some(v => v == null) ? "partial" : "ok";
}

const HealthContext = createContext(null);

export function HealthProvider({
  children,
  fetchStoreImpl = fetchStore,
  fetchMetricsImpl = fetchMetrics,
  fetchDiskTrendImpl = fetchDiskTrend,
  fetchFeeRecipientsImpl = fetchFeeRecipients,
  fetchCareStatusImpl = fetchCareStatus,
  fetchLostDataImpl = listLostData,
  fetchIpfsHealthImpl = getIpfsHealth,
  fetchDiagnosticsImpl = getDiagnostics,
}) {
  const packages = useSelector(getDnpInstalled) || [];
  const stats = useSelector(getDappnodeStats) || {};
  const params = useSelector(getDappnodeParams) || {};
  const chainData = useSelector(getChainData) || [];
  const coreAvailable = useSelector(getCoreUpdateAvailable);
  const diagnoses = useSelector(getDiagnoses) || [];
  // `ready`: the installed-packages list has actually arrived. On a real box
  // `dnpInstalled` is usually populated by a WAMP push (API/subscriptions.js
  // "packages.dappmanager…" -> updateDnpInstalled), which never touches the
  // loadingStatus reducer's isLoading/isLoaded flags at all — those only
  // reflect the initial `listPackages` saga, which can itself be slow
  // (docker df) or fail. So `getIsLoaded.dnpInstalled` alone is not a
  // reliable "has data arrived" signal: ready whenever ANY of a) packages
  // are already there (a real AVADO always has core packages installed),
  // b) the loadingStatus flag did fire, or c) dnpInstalled loading errored
  // (show findings anyway — the core/connection diagnoses explain why).
  const dnpInstalledLoaded = useSelector(getIsLoaded.dnpInstalled);
  const dnpInstalledError = useSelector(getLoadingError.dnpInstalled);
  const ready = packages.length > 0 || dnpInstalledLoaded || Boolean(dnpInstalledError);

  const [store, setStore] = useState({ status: "loading", packages: null });
  const [metrics, setMetrics] = useState({ status: "not-installed", data: null });
  // Disk forecast inputs (fetchDiskTrend): "not-installed" while Prometheus
  // doesn't run, "loading" until the first answer, then "ok" or "failed".
  const [diskTrend, setDiskTrend] = useState({ status: "not-installed", data: null });
  const [tick, setTick] = useState(0);
  const [dismissVersion, setDismissVersion] = useState(0);
  const [feeRecipients, setFeeRecipients] = useState(null);
  const [careFindings, setCareFindings] = useState([]);
  // DAPPMANAGER listLostData: packages whose data sits in an unused storage
  // volume. null until read, and while the DAPPMANAGER is older than 10.0.51
  // (the lostData rule is then skipped).
  const [lostData, setLostData] = useState(null);
  // The scan in progress: never two at once (a DAPPMANAGER scan probes
  // volumes one by one and can take minutes on a box with big ones).
  // `again`: a forced scan asked for while one ran; it runs right after.
  const lostDataScan = useRef({ pending: false, again: false, startedAt: 0 });
  const lostDataAllowedRef = useRef(false);
  const fetchLostDataRef = useRef(fetchLostDataImpl);
  fetchLostDataRef.current = fetchLostDataImpl;
  // DAPPMANAGER getIpfsHealth (10.0.52 and newer): null until read, and with
  // an older DAPPMANAGER (the ipfsRestarting rule is then skipped).
  const [ipfsHealth, setIpfsHealth] = useState(null);
  // This page's IPFS reset (pages/system/ipfsResetApi): running, done, error.
  const [ipfsReset, setIpfsReset] = useState(ipfsResetState);
  const [ipfsTick, setIpfsTick] = useState(0);
  const fetchIpfsHealthRef = useRef(fetchIpfsHealthImpl);
  fetchIpfsHealthRef.current = fetchIpfsHealthImpl;
  // DAPPMANAGER getDiagnostics (10.0.53 and newer), containers and their
  // programs only: null until read, and with an older DAPPMANAGER (the
  // process rules are then skipped).
  const [diagnostics, setDiagnostics] = useState(null);
  const fetchDiagnosticsRef = useRef(fetchDiagnosticsImpl);
  fetchDiagnosticsRef.current = fetchDiagnosticsImpl;

  // A string derived from installed name@version pairs. Used as an effect
  // dependency instead of the `packages` array itself, whose identity changes
  // on every WAMP push (running/stopped, stats, ...) even when no version
  // actually changed.
  const packageKey = packages.map(p => `${p.name}@${p.version}`).join("|");
  const prometheusRunning = packages.some(p => p.name === PROMETHEUS_PACKAGE && p.running);
  // Which browser-readable validator clients run, as a stable string (effect
  // dependency). None is readable from http://my.ava.do today (their CORS
  // lists leave the Admin out, see health/feeRecipients.js), so no request
  // is made and `feeRecipients` stays null (the rule is skipped).
  const validatorKey = packages
    .filter(p => p.running && VALIDATOR_CLIENTS.some(c => c.name === p.name && c.browserReadable))
    .map(p => p.name)
    .sort()
    .join("|");

  // Store catalogue (updates). Depends on `packageKey`, not `packages`, so a
  // WAMP push that leaves installed versions unchanged does not refetch the
  // store catalogue on every render.
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

  // If nodeid never arrives (e.g. dappnodeStatus is slow or fails), the
  // effect above never runs and store.status would stay at its initial
  // "loading" forever — spinning SystemUpdates' "Checking for updates…"
  // indefinitely. After ~20s without a nodeid, surface it as a failure
  // instead, so SystemUpdates falls back to its "can't reach the store"
  // message rather than spinning forever.
  useEffect(() => {
    if (params.nodeid) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) setStore(prev => (prev.status === "loading" ? { status: "failed", packages: prev.packages } : prev));
    }, NODEID_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [params.nodeid]);

  // Prometheus metrics, only when the monitoring package runs. Depends on
  // `prometheusRunning`/`tick`, not `packageKey`: which packages are
  // installed/updated is irrelevant here, only whether Prometheus itself is up.
  useEffect(() => {
    if (!prometheusRunning) {
      setMetrics({ status: "not-installed", data: null });
      return;
    }
    let cancelled = false;
    const load = () =>
      fetchMetricsImpl().then(
        // `fetchedAt` travels with the sample: Home's chain strip compares a
        // head slot against the wall clock *at the time it was fetched*, not
        // against `checkedAt`, which the 5 s stats poll keeps moving forward
        // while this sample is up to METRICS_INTERVAL old.
        data => !cancelled && setMetrics({ status: metricsStatus(data), data, fetchedAt: data ? Date.now() : null })
      );
    load();
    const t = setInterval(load, METRICS_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [prometheusRunning, tick]);

  // The disk trend, apart from the chain metrics above: its own requests and
  // state, so a slow or failing disk query never holds up or blanks head
  // slot, peers or attestations. Every 10 minutes (6 small queries). A
  // failed read (fetchDiskTrend is null when any one query failed) keeps the
  // last good one for up to an hour (the trend spans days), so one lost
  // request doesn't make a disk finding come and go.
  useEffect(() => {
    if (!prometheusRunning) {
      setDiskTrend({ status: "not-installed", data: null });
      return undefined;
    }
    let cancelled = false;
    setDiskTrend(prev => (prev.data ? prev : { status: "loading", data: null }));
    const load = () =>
      fetchDiskTrendImpl()
        .catch(() => null)
        .then(data => {
          if (cancelled) return;
          const now = Date.now();
          setDiskTrend(prev =>
            data
              ? { status: "ok", data, fetchedAt: now }
              : { status: "failed", data: prev.data && now - prev.fetchedAt < DISK_TREND_KEEP_MS ? prev.data : null, fetchedAt: prev.fetchedAt }
          );
        });
    load();
    const t = setInterval(load, DISK_TREND_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [prometheusRunning, tick]);

  // Fee recipients of the loaded validator keys, only while a validator client runs.
  useEffect(() => {
    if (!validatorKey) {
      setFeeRecipients(null);
      return undefined;
    }
    let cancelled = false;
    const load = () =>
      fetchFeeRecipientsImpl(packages, undefined, { browser: true })
        .then(r => !cancelled && setFeeRecipients(r))
        .catch(() => !cancelled && setFeeRecipients(null));
    load();
    const t = setInterval(load, FEE_RECIPIENT_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [validatorKey, tick]);

  // AVADO Care's fee-recipient findings (it can read the validator clients,
  // the browser can't). Only while the Care package runs; every 10 minutes,
  // skipped while the tab is hidden. Unreadable → no Care findings.
  const careRunning = packages.some(p => p.name === CARE_PACKAGE && p.running);
  useEffect(() => {
    if (!careRunning) {
      setCareFindings([]);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchCareStatusImpl()
        .then(status => !cancelled && setCareFindings(careFindingsFromStatus(status)))
        .catch(() => !cancelled && setCareFindings([]));
    };
    load();
    const t = setInterval(load, CARE_STATUS_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [careRunning, tick]);

  // Lost data (DAPPMANAGER 10.0.51 and newer only: an older core never gets
  // the call). Every 10 minutes, on "Check again", on each Home visit and
  // after a recovery (refreshLostData). A scan is skipped while another one
  // runs. A failed read keeps the last answer and leaves one debug line.
  const lostDataAllowed = canFindLostData(packages);
  lostDataAllowedRef.current = lostDataAllowed;
  const scanLostData = useCallback(function scan(force) {
    const state = lostDataScan.current;
    if (!lostDataAllowedRef.current) return;
    if (state.pending) {
      if (force) state.again = true;
      return;
    }
    state.pending = true;
    state.again = false;
    state.startedAt = Date.now();
    Promise.resolve()
      .then(() => fetchLostDataRef.current())
      .then(
        list => lostDataAllowedRef.current && setLostData(Array.isArray(list) ? list : []),
        e => console.debug(`listLostData failed: ${e && e.message}`)
      )
      .then(() => {
        state.pending = false;
        if (state.again) scan(true);
      });
  }, []);
  useEffect(() => {
    if (!lostDataAllowed) {
      setLostData(null);
      return undefined;
    }
    scanLostData(false);
    const t = setInterval(() => scanLostData(false), LOST_DATA_INTERVAL);
    return () => clearInterval(t);
  }, [lostDataAllowed, tick, scanLostData]);
  // Home: nothing to do before the first scan (the effect above runs it as
  // soon as the DAPPMANAGER is known to have the call), nor within 30 s of
  // the last one. `force` (after a recovery) skips both checks.
  const refreshLostData = useCallback(
    ({ force = false } = {}) => {
      const started = lostDataScan.current.startedAt;
      if (force || (started && Date.now() - started >= LOST_DATA_MIN_GAP_MS)) scanLostData(force);
    },
    [scanLostData]
  );

  // IPFS health, every 2 minutes while the tab is shown, and again as soon as
  // a reset ends. A failed read keeps the last answer and leaves a debug line.
  const ipfsAllowed = canResetIpfsData(packages);
  // When a reset ends: read the health again at once, and again once its
  // result note on Home has run out (the rule reads `now`).
  useEffect(() => {
    let noteTimer = null;
    const unsubscribe = subscribeIpfsReset(next => {
      setIpfsReset(next);
      if (next && next.status !== "running") {
        setIpfsTick(t => t + 1);
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => setIpfsTick(t => t + 1), IPFS_RESULT_NOTE_MS + 1000);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(noteTimer);
    };
  }, []);
  useEffect(() => {
    if (!ipfsAllowed) {
      setIpfsHealth(null);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      Promise.resolve()
        .then(() => fetchIpfsHealthRef.current())
        .then(
          health => {
            if (cancelled || !health || typeof health !== "object") return;
            setIpfsHealth(health);
            noteIpfsHealth(health);
          },
          e => console.debug(`getIpfsHealth failed: ${e && e.message}`)
        );
    };
    load();
    const t = setInterval(load, IPFS_HEALTH_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [ipfsAllowed, tick, ipfsTick]);

  // What runs inside each container, every minute while the tab is shown. A
  // failed read keeps the last answer and leaves a debug line.
  // The DAPPMANAGER's own version too: see canGetDiagnostics
  const dappmanagerVersionData = useSelector(getDappmanagerVersionData);
  const diagnosticsAllowed = canGetDiagnostics(packages, dappmanagerVersionData && dappmanagerVersionData.version);
  useEffect(() => {
    if (!diagnosticsAllowed) {
      setDiagnostics(null);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      Promise.resolve()
        .then(() => fetchDiagnosticsRef.current(LIGHT_DIAGNOSTICS))
        .then(
          d => {
            if (!cancelled && d && typeof d === "object") setDiagnostics(d);
          },
          e => console.debug(`getDiagnostics failed: ${e && e.message}`)
        );
    };
    load();
    const t = setInterval(load, DIAGNOSTICS_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [diagnosticsAllowed, tick]);

  const updates = useMemo(
    () => (store.packages ? computeUpdates(store.packages, packages) : null),
    [store.packages, packageKey]
  );

  // First-seen time of each pending update (for the 48 h "update blocked" check).
  const updateAges = useMemo(() => {
    const ages = trackUpdateAges(readUpdateAges(), updates, Date.now());
    if (updates) writeUpdateAges(ages);
    return ages;
  }, [updates]);

  const value = useMemo(() => {
    const snapshot = {
      packages,
      stats,
      params,
      diagnoses,
      chainData,
      updates,
      // The Admin's own core-update check (services/coreUpdate checkCoreUpdate)
      // is disabled, so "no update" can't be told apart from "never checked":
      // null (coreUpdateAvailable is skipped) unless an update was reported.
      coreUpdate: coreAvailable ? { available: true } : null,
      metrics: metrics.data,
      diskTrend: diskTrend.data,
      feeRecipients,
      updateAges,
      lostData,
      ipfsHealth,
      ipfsReset,
      diagnostics,
      sources: { updates: store.status, metrics: metrics.status },
      // Recomputed whenever this memo re-runs, which includes every metrics
      // poll (`metrics` is a dep below). head-behind is the only rule that
      // reads the wall clock, and it always needs a fresh `now` alongside a
      // fresh `metrics.headSlot` sample to compute how far behind a client is.
      now: Date.now(),
    };
    // Findings are not computed until `ready`: with an empty/partial
    // `packages` snapshot every rule would just find nothing wrong, which
    // would flash a false "all good" verdict before the real data arrives.
    const { findings: ownFindings, passed: checksPassed, total: checksTotal } = ready
      ? runChecksDetailed(snapshot, ALL_RULES)
      : { findings: [], passed: 0, total: 0 };
    const allFindings = ready ? sortFindings(mergeCareFindings(ownFindings, careFindings)) : ownFindings;
    const findings = ready ? allFindings.filter(f => !(f.dismissable && isDismissed(f.id))) : [];
    return {
      ready,
      // Installed packages and per-client chain status, for consumers that
      // render them directly (Home's chain strip).
      packages,
      chainData,
      findings,
      allFindings,
      verdict: verdictOf(findings),
      checkedAt: new Date(snapshot.now),
      sources: snapshot.sources,
      // Raw Prometheus samples (headSlot/peers/... per client+network), so
      // consumers that need more than the derived findings — e.g. Home's
      // chain strip (Advanced mode) — can read them directly instead of
      // re-deriving from `sources.metrics` (which only carries the status).
      metrics: snapshot.metrics,
      // When `metrics` was fetched (a Date), null while there is no sample.
      metricsFetchedAt: metrics.data && metrics.fetchedAt ? new Date(metrics.fetchedAt) : null,
      // Machine stats (getStats), for System > Storage and the disk findings'
      // "Get more space" link (health/diskUpgrade.js reads cpuName/diskTotal).
      stats,
      // Disk-full forecast (health/rules/storage.js diskForecast) and whether
      // its data could be read, for System > Storage.
      diskForecast: diskForecast(diskTrend.data, chainData),
      diskTrendStatus: diskTrend.status,
      updates: updates || {},
      storePackages: store.packages,
      checksPassed,
      checksTotal,
      refresh: () => setTick(t => t + 1),
      // Scans for lost data again (DAPPMANAGER 10.0.51 and newer). Home calls
      // it on each visit (skipped within 30 s of the last scan or before the
      // first one); the Recover data card with { force: true } when done.
      refreshLostData,
      dismiss: id => {
        persistDismiss(id);
        setDismissVersion(v => v + 1);
      },
      // Brings every hidden tip back. Bumps dismissVersion like dismiss does:
      // refresh() would only refetch, and `tick` does not re-run this memo.
      undismissAll: () => {
        persistUndismissAll();
        setDismissVersion(v => v + 1);
      },
    };
  }, [ready, packages, stats, params, diagnoses, chainData, updates, updateAges, feeRecipients, careFindings, lostData, ipfsHealth, ipfsReset, diagnostics, refreshLostData, coreAvailable, metrics, diskTrend, store, dismissVersion]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw Error("useHealth must be used inside <HealthProvider>");
  return ctx;
}
