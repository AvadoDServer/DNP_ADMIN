import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappnodeStats, getDappnodeParams } from "services/dappnodeStatus/selectors";
import { getChainData } from "services/chainData/selectors";
import { getCoreUpdateAvailable } from "services/coreUpdate/selectors";
import { getDiagnoses } from "pages/troubleshoot/selectors";
import { getIsLoaded, getLoadingError } from "services/loadingStatus/selectors";
import { fetchStore } from "services/store/fetchStore";
import { computeUpdates } from "services/store/updates";
import { fetchMetrics } from "./prometheus";
import { fetchFeeRecipients, VALIDATOR_CLIENTS } from "./feeRecipients";
import { trackUpdateAges } from "./updateAges";
import { CARE_PACKAGE, careFindingsFromStatus, fetchCareStatus, mergeCareFindings } from "./careFindings";
import { PROMETHEUS_PACKAGE } from "./clients";
import { runChecksDetailed, verdictOf, SEVERITIES, TOPICS } from "./engine";

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
import { isDismissed, dismiss as persistDismiss } from "./dismissals";

const STORE_INTERVAL = 10 * 60 * 1000;
const METRICS_INTERVAL = 60 * 1000;
const NODEID_TIMEOUT_MS = 20 * 1000;
const FEE_RECIPIENT_INTERVAL = 10 * 60 * 1000;
const CARE_STATUS_INTERVAL = 10 * 60 * 1000;
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

const HealthContext = createContext(null);

export function HealthProvider({
  children,
  fetchStoreImpl = fetchStore,
  fetchMetricsImpl = fetchMetrics,
  fetchFeeRecipientsImpl = fetchFeeRecipients,
  fetchCareStatusImpl = fetchCareStatus,
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
  const [tick, setTick] = useState(0);
  const [dismissVersion, setDismissVersion] = useState(0);
  const [feeRecipients, setFeeRecipients] = useState(null);
  const [careFindings, setCareFindings] = useState([]);

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
        data => !cancelled && setMetrics({ status: data ? "ok" : "failed", data, fetchedAt: data ? Date.now() : null })
      );
    load();
    const t = setInterval(load, METRICS_INTERVAL);
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
      coreUpdate: { available: Boolean(coreAvailable) },
      metrics: metrics.data,
      feeRecipients,
      updateAges,
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
      updates: updates || {},
      storePackages: store.packages,
      checksPassed,
      checksTotal,
      refresh: () => setTick(t => t + 1),
      dismiss: id => {
        persistDismiss(id);
        setDismissVersion(v => v + 1);
      },
    };
  }, [ready, packages, stats, params, diagnoses, chainData, updates, updateAges, feeRecipients, careFindings, coreAvailable, metrics, store, dismissVersion]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw Error("useHealth must be used inside <HealthProvider>");
  return ctx;
}
