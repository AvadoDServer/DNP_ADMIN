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
