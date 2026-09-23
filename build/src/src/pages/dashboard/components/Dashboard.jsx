import PropTypes from "prop-types";
import { useEffect } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { Link } from "react-router-dom";
import { fetchDappnodeStats } from "services/dappnodeStatus/actions";
// Selectors
import { getDappnodeStats } from "services/dappnodeStatus/selectors";
import { getConnectionStatus } from "services/connectionStatus/selectors";
import { useHealth } from "health/HealthProvider";
// Own module
import VerdictPanel from "./VerdictPanel";
import ResourcesStrip from "./ResourcesStrip";
import ChainStatus from "./ChainStatus";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import Skeleton from "components/ui/Skeleton";
import { PageHeader, SectionHeader } from "components/ui/PageHeader";
import AppCard from "components/apps/AppCard";
import AvadoDevice from "components/box/AvadoDevice";
import * as s from "../../packages/selectors.js";

/** Shimmer placeholder for an app "bay" (AppCard's shape), shown while packages are still loading. */
function AppCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col gap-3.5 rounded-tile bg-surface p-5 shadow-[0_1px_0_rgb(var(--border))] dark:border dark:border-border dark:shadow-none">
      <div className="flex items-center justify-between">
        <Skeleton className="h-11 w-11" rounded="lg" />
        <Skeleton className="h-2.5 w-2.5" rounded="full" />
      </div>
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

/**
 * @param {object} dappnodeStats = { cpu, disk, memory, ... }
 * @param {object} connection = { isOpen, error, session, isNotAdmin }
 *
 * NOTE: data wiring (selectors, fetchDappnodeStats polling, WAMP-backed
 * store, REACT_APP_MOCK_DATA path) is unchanged — only presentation.
 */
function Dashboard({
  dappnodeStats,
  connection,
  fetchDappnodeStats,
  installedpackages,
  history,
}) {
  const { ready, verdict } = useHealth();
  // The device's status light always agrees with VerdictPanel: grey while
  // health isn't ready yet, otherwise the verdict's own level (its values —
  // ok/warning/critical — line up 1:1 with AvadoDevice's `light` prop).
  const deviceLight = ready ? verdict.level : "checking";

  useEffect(() => {
    const interval = setInterval(fetchDappnodeStats, 5 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // A manifest-less package (e.g. its manifest failed to fetch) still shows
  // up here — AppCard/AppAvatar/appTitle all fall back to the package name
  // when there's no manifest, so there's no reason to hide it from "Running
  // on your AVADO".
  const activePackages = installedpackages.filter(
    (dnp) => dnp && dnp.isCore === false
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Home" subtitle="Whether your AVADO is healthy, and what runs on it.">
        <Badge variant={connection.isOpen ? "success" : "danger"} dot>
          {connection.isOpen ? "Connected" : "Disconnected"}
        </Badge>
      </PageHeader>

      {/* PageHeader carries its own bottom margin, so it stays outside this
          gapped column — otherwise its margin and the gap would stack into
          one oversized space instead of an even 24 px between sections. */}
      <div className="flex flex-col gap-7">
        <ChainStatus />

        <section className="grid grid-cols-1 items-center gap-8 py-2 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col items-center gap-6">
            <AvadoDevice light={deviceLight} />
            <ResourcesStrip stats={dappnodeStats} />
          </div>
          <VerdictPanel />
        </section>

        <section aria-labelledby="apps-title">
          <SectionHeader
            title={<span id="apps-title">Running on your AVADO</span>}
            count={activePackages.length}
            action={
              <Link to="/installer" className="text-sm font-semibold text-accent hover:underline">
                Add an app
              </Link>
            }
            first
          />
          {!ready ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <AppCardSkeleton key={i} />)}
            </div>
          ) : activePackages.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="mb-1 font-display text-lg font-semibold text-fg">Your AVADO is ready</p>
              <p className="mb-4 text-sm text-fg-muted">Start with Staking setup, or browse the DappStore for other apps.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => history.push("/staking")}>Staking setup</Button>
                <Button size="sm" variant="secondary" onClick={() => history.push("/installer")}>DappStore</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {activePackages.map(p => <AppCard key={p.name} pkg={p} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

Dashboard.propTypes = {
  installedpackages: PropTypes.array.isRequired,
  dappnodeStats: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
};

const mapStateToProps = createStructuredSelector({
  dappnodeStats: getDappnodeStats,
  connection: getConnectionStatus,
  installedpackages: s.getFilteredPackages,
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = {
  fetchDappnodeStats,
};

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
export { Dashboard };
