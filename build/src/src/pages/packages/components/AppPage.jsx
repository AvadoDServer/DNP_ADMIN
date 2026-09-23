import React, { useEffect, useRef, useState } from "react";
import { connect, useDispatch } from "react-redux";
import { createStructuredSelector } from "reselect";
import * as s from "../selectors";
import * as a from "../actions";
import { rootPath } from "../data";
import { useTheme } from "theme/ThemeProvider";
import { useHealth } from "health/HealthProvider";
import { useMode } from "settings/ModeProvider";
import { tabsForMode, ADVANCED_TABS } from "settings/visibility";
import { appStatus, appDescription } from "components/appStatus";
import { appTitle } from "health/rules/apps";
import { getClient, ROLES } from "health/clients";
import { openUrl } from "components/apps/AppCard";
import AppAvatar from "components/ui/AppAvatar";
import StatusPill from "components/ui/StatusPill";
import Tabs from "components/ui/Tabs";
import Button from "components/ui/Button";
import { cn } from "components/ui/cn";
import AdvancedNote from "components/AdvancedNote";
import AppOverview from "./AppOverview";
import SetupFrame from "./SetupFrame";
import Envs from "./PackageViews/Envs";
import FileManager from "./PackageViews/FileManager";
import Logs from "./PackageViews/Logs";
import NoDnpInstalled from "./NoDnpInstalled";
import { LoadingState } from "./PackagePresentation";
import { getIsLoading } from "services/loadingStatus/selectors";
import confirmRestartPackage from "./confirmRestartPackage";
import confirmResetPackage from "./confirmResetPackage";
import confirmRemovePackage from "./confirmRemovePackage";
import confirmStopPackage from "./confirmStopPackage";

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

const menuBtnCls =
  "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg focus:outline-none focus-visible:shadow-focus";

/**
 * The header's overflow menu ("⋮"): a small accessible menu button.
 * - aria-haspopup / aria-expanded on the trigger.
 * - Escape closes the menu and returns focus to the trigger.
 * - A click outside the menu also closes it.
 */
function OverflowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  };

  const onKeyDown = e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };

  if (!items.length) return null;

  return (
    <div ref={containerRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(o => !o)}
        className={menuBtnCls}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm shadow-xl"
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-fg/[0.06]",
                item.tone === "danger" ? "text-danger-text" : "text-fg"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppPage({ dnp, id, loading, history, location, isCore: isCoreProp = false }) {
  const { theme } = useTheme();
  const { findings, updates } = useHealth();
  const { mode, isAdvanced } = useMode();
  const dispatch = useDispatch();
  if (!dnp) return loading ? <LoadingState label="Loading app…" /> : <NoDnpInstalled id={id} moduleName="packages" />;

  // `isCore` from the route is only true under /system/:id (see
  // pages/system/components/SystemRoot.jsx); a core app reached via
  // /packages/<core-id> instead (e.g. the appRestarting finding's "Open the
  // logs" link) would otherwise be treated as an ordinary app and offered
  // Stop/Reset/Remove. Fall back to the package's own isCore either way.
  const isCore = isCoreProp || Boolean(dnp.isCore);

  const url = wizardUrl(dnp, theme);
  const tabs = tabsFor(Boolean(url));
  // The tab bar itself only ever offers what this mode allows (spec §5:
  // "App page tabs | Overview, Setup | + Logs, Settings, Files"); a deep
  // link such as `?tab=logs` still opens its content in Simple mode (never
  // a 404), just with an "Advanced page" note instead of a selected pill —
  // see `active` below, which is resolved against the full `tabs` list.
  const visibleTabs = tabsForMode(tabs, mode);
  const requested = new URLSearchParams(location.search).get("tab");
  const active = tabs.some(t => t.id === requested) ? requested : visibleTabs[0].id;
  const showAdvancedNote = mode === "simple" && ADVANCED_TABS.includes(active);
  const ownFindings = findings.filter(f => f.appId === dnp.name && f.severity !== "info").length;
  const shownTabs = visibleTabs.map(t => (t.id === "overview" && ownFindings ? { ...t, badge: ownFindings } : t));
  const setTab = tab => history.replace({ pathname: location.pathname, search: `?tab=${tab}` });

  // Header actions. Reuse the same confirm helpers / thunks as the Overview
  // tab's Controls panel (PackageViews/Controls.jsx) rather than duplicating
  // that logic here.
  const title = appTitle(dnp);
  const external = openUrl(dnp);
  const showOpen = Boolean(external || url);
  const running = dnp.state === "running";

  const isConsensus = getClient(dnp.name)?.role === ROLES.CONSENSUS;

  const restart = () => confirmRestartPackage(dnp.name, restartId => dispatch(a.restartPackage(restartId)));
  // Starting is not destructive and needs no confirmation; stopping does,
  // since it takes the app (and, for a client, its validators) offline.
  const toggle = () => {
    if (running) confirmStopPackage(dnp.name, toggleId => dispatch(a.togglePackage(toggleId)), title);
    else dispatch(a.togglePackage(dnp.name));
  };
  const reset = () =>
    confirmResetPackage(dnp.name, resetId => dispatch(a.restartPackageVolumes(resetId)), {
      consensus: isConsensus,
      title,
    });
  const remove = () =>
    confirmRemovePackage(dnp.name, (removeId, deleteVolumes) =>
      Promise.resolve(dispatch(a.removePackage(removeId, deleteVolumes))).then(
        () => history && history.push(rootPath),
        () => {} // the toast already reported the error
      )
    );

  // Stop/Start acts directly on the container; hide it for core (system)
  // services in this menu the same way Reset/Remove already are.
  const menuItems = [
    ...(!isCore ? [{ label: running ? "Stop" : "Start", onClick: toggle }] : []),
    ...(!isCore ? [{ label: "Reset", onClick: reset }] : []),
    ...(!isCore ? [{ label: "Remove", tone: "danger", onClick: remove }] : []),
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AppAvatar pkg={dnp} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="mb-0 break-words font-display text-2xl font-bold text-fg">{title}</h1>
          <p className="mb-0 text-sm text-fg-muted">{appDescription(dnp)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={appStatus(dnp, { findings, updates })} />
          {isAdvanced && dnp.version && <span className="font-mono text-xs text-fg-subtle">v{dnp.version}</span>}
          {showOpen &&
            (external ? (
              <Button as="a" href={external} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
                Open
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setTab("setup")}>
                Open
              </Button>
            ))}
          <Button variant="secondary" size="sm" onClick={restart}>
            Restart
          </Button>
          <OverflowMenu label={`More actions for ${title}`} items={menuItems} />
        </div>
      </header>
      <Tabs tabs={shownTabs} active={active} onChange={setTab} />
      {showAdvancedNote && (
        <AdvancedNote>
          This tab is usually only shown in advanced mode. Switch to advanced to see it here next time.
        </AdvancedNote>
      )}
      {active === "setup" && url && <SetupFrame url={url} title={title} />}
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
