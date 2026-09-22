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
