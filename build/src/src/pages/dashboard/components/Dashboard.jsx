import PropTypes from "prop-types";
import { useEffect } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { fetchDappnodeStats } from "services/dappnodeStatus/actions";
// Selectors
import { getChainData } from "services/chainData/selectors";
import { getDappnodeStats } from "services/dappnodeStatus/selectors";
import { getConnectionStatus } from "services/connectionStatus/selectors";
// Own module
import VerdictPanel from "./VerdictPanel";
import ResourcesStrip from "./ResourcesStrip";
import ChainLine from "./ChainLine";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import { PageHeader, SectionHeader } from "components/ui/PageHeader";
import AppCard from "components/apps/AppCard";
import * as s from "../../packages/selectors.js";

/**
 * @param {array} chainData
 * @param {object} dappnodeStats = { cpu, disk, memory, ... }
 * @param {object} connection = { isOpen, error, session, isNotAdmin }
 *
 * NOTE: data wiring (selectors, fetchDappnodeStats polling, WAMP-backed
 * store, REACT_APP_MOCK_DATA path) is unchanged — only presentation.
 */
function Dashboard({
  chainData,
  dappnodeStats,
  connection,
  fetchDappnodeStats,
  installedpackages,
  history,
}) {
  useEffect(() => {
    const interval = setInterval(fetchDappnodeStats, 5 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const activePackages = installedpackages.filter(
    (dnp) => dnp && dnp.isCore === false && dnp.manifest
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
      <div className="flex flex-col gap-6">
        <VerdictPanel />

        <ResourcesStrip stats={dappnodeStats} />

        <ChainLine chainData={chainData} />

        <section aria-labelledby="apps-title">
          <SectionHeader
            title={<span id="apps-title">Your apps</span>}
            count={activePackages.length}
            action={
              <Button variant="ghost" size="sm" onClick={() => history.push("/installer")}>
                DappStore
              </Button>
            }
            first
          />
          {activePackages.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="mb-1 font-display text-lg font-semibold text-fg">Your AVADO is ready</p>
              <p className="mb-4 text-sm text-fg-muted">Start with Staking setup, or browse the DappStore for other apps.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => history.push("/staking")}>Staking setup</Button>
                <Button size="sm" variant="secondary" onClick={() => history.push("/installer")}>DappStore</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
  chainData: PropTypes.array.isRequired,
  dappnodeStats: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
};

const mapStateToProps = createStructuredSelector({
  chainData: getChainData,
  dappnodeStats: getDappnodeStats,
  connection: getConnectionStatus,
  installedpackages: s.getFilteredPackages,
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = {
  fetchDappnodeStats,
};

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
