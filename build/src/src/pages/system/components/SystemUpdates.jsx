import React from "react";
import { Link } from "react-router-dom";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { useHealth } from "health/HealthProvider";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getCoreUpdateAvailable, getCoreDeps } from "services/coreUpdate/selectors";
import { appTitle } from "health/rules/apps";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import AppAvatar from "components/ui/AppAvatar";
import { SectionHeader } from "components/ui/PageHeader";

function AppUpdateRow({ pkg, update }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <AppAvatar pkg={pkg} size={36} />
        <div className="min-w-0">
          <div className="break-words font-medium text-fg">{appTitle(pkg)}</div>
          <div className="font-mono text-xs text-fg-subtle">
            {update.from} → {update.to}
          </div>
        </div>
      </div>
      <Button as={Link} to={`/installer/${pkg.name}`} size="sm" className="flex-shrink-0 sm:min-w-[8rem]">
        Update
      </Button>
    </li>
  );
}

/**
 * `dnpInstalled` / `coreUpdateAvailable` / `coreDeps` come from `connect`
 * below; `updates` / `sources` come straight from `useHealth()`, same as
 * every other page that reads app health (AppCard, AppPage, ...).
 */
function SystemUpdates({ dnpInstalled, coreUpdateAvailable, coreDeps }) {
  const { updates, sources } = useHealth();
  const rows = Object.entries(updates || {}).map(([name, update]) => ({
    pkg: (dnpInstalled || []).find(p => p.name === name) || { name },
    update,
  }));
  const failedToCheck = sources && sources.updates === "failed";

  return (
    <div className="animate-fade-in">
      <SectionHeader title="App updates" count={rows.length} first />
      <Card padding="none">
        {failedToCheck ? (
          <p className="p-4 text-sm text-fg-muted">
            Can't check for updates right now: your AVADO can't reach the AVADO store.
          </p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">All apps are up to date.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ pkg, update }) => (
              <AppUpdateRow key={pkg.name} pkg={pkg} update={update} />
            ))}
          </ul>
        )}
      </Card>

      <SectionHeader title="System update" />
      <Card padding="lg">
        {coreUpdateAvailable ? (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1.5">
              {(coreDeps || []).map(dep => (
                <li
                  key={dep.name}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-sm text-fg-muted"
                >
                  <span className="min-w-0 break-words font-medium text-fg">
                    {appTitle({ name: dep.name, manifest: dep.manifest })}
                  </span>
                  <span className="font-mono text-xs">
                    {dep.from} → {dep.to}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button as={Link} to="/system/update" variant="primary" size="sm" className="flex-shrink-0">
                Update system
              </Button>
              <p className="mb-0 text-sm text-fg-muted">
                Keep your AVADO powered on during the update. It takes a few minutes.
              </p>
            </div>
          </div>
        ) : (
          <p className="mb-0 text-sm text-fg-muted">Your AVADO system is up to date.</p>
        )}
      </Card>
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  dnpInstalled: getDnpInstalled,
  coreUpdateAvailable: getCoreUpdateAvailable,
  coreDeps: getCoreDeps,
});

export default connect(mapStateToProps)(SystemUpdates);
export { SystemUpdates };
