import PropTypes from "prop-types";
import { useEffect } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { fetchDappnodeStats } from "services/dappnodeStatus/actions";
// Selectors
import { getChainData } from "services/chainData/selectors";
import { getDappnodeStats } from "services/dappnodeStatus/selectors";
import { getDappnodeVolumes } from "services/dnpInstalled/selectors";
// Own module
import ChainCard from "./ChainCard";
import StatsCard from "./StatsCard";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import { PageHeader, SectionHeader } from "components/ui/PageHeader";
import * as s from "../../packages/selectors.js";
import { stringIncludes } from "utils/strings";
import defaultAvatar from "img/defaultAvatar.png";

/**
 * @param {array} chainData
 * @param {object} dappnodeStats = { cpu, disk, memory, ... }
 * @param {array} dappnodeVolumes
 *
 * NOTE: data wiring (selectors, fetchDappnodeStats polling, WAMP-backed
 * store, REACT_APP_MOCK_DATA path) is unchanged — only presentation.
 */
function Dashboard({
  chainData,
  dappnodeStats,
  dappnodeVolumes,
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

  const hashToUrl = (hash) => {
    if (!hash) return null;
    return `http://ipfs.my.ava.do:8080/ipfs/${hash.replace("/ipfs/", "")}`;
  };

  const openDnp = (name) => {
    history.push(`/Packages/${name}`);
  };

  const activePackages = installedpackages.filter(
    (dnp) => dnp && dnp.isCore === false && dnp.manifest
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Home"
        subtitle="How your AVADO is doing and what is running on it."
      >
        <Badge variant="success" dot>
          Online
        </Badge>
      </PageHeader>

      {/* Health */}
      <SectionHeader title="Health" first />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          id="Cpu"
          percent={dappnodeStats?.cpu || "0%"}
          subtitle={dappnodeStats?.cpuName}
        />
        <StatsCard
          id="Memory"
          percent={dappnodeStats?.memory || "0%"}
          used={dappnodeStats?.memUsed}
          total={dappnodeStats?.memTotal}
        />
        <StatsCard
          id="Disk"
          percent={dappnodeStats?.disk || "0%"}
          used={dappnodeStats?.diskUsed}
          total={dappnodeStats?.diskTotal}
        />
      </div>

      {/* Chains */}
      {chainData && chainData.length > 0 && (
        <>
          <SectionHeader title="Chains" count={chainData.length} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chainData.map((chain, i) => (
              <ChainCard key={i} {...chain} />
            ))}
          </div>
        </>
      )}

      {/* Active packages */}
      <SectionHeader
        title="Active Packages"
        count={activePackages.length}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => history.push("/installer")}
          >
            Browse DappStore
          </Button>
        }
      />

      {activePackages.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
              </svg>
            </span>
            <div>
              <div className="font-semibold text-fg">No active applications yet</div>
              <p className="mt-1 text-sm text-fg-muted">
                Install your first package from the DappStore to get started.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => history.push("/installer")}>
              Open DappStore
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activePackages.map((dnp, i) => {
            const { manifest, origin, tag } = dnp || {};
            const { title } = manifest || {};
            // A package whose manifest lacks a name still has a container name
            const name = (manifest || {}).name || dnp.name;
            /* Show the button as disabled (gray) if it's updated */
            const disabled = stringIncludes(tag, "updated");
            const avatarUrl = hashToUrl(manifest.avatar) || defaultAvatar;
            return (
              <Card
                key={`${name}_${origin}_${i}`}
                interactive
                padding="md"
                role="button"
                tabIndex={0}
                onClick={() => openDnp(dnp.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDnp(dnp.name);
                  }
                }}
                className="group flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={avatarUrl}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.src = defaultAvatar;
                    }}
                    className="h-12 w-12 flex-shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h5
                      className="truncate font-semibold capitalize text-fg"
                      title={title || name}
                    >
                      {title || name}
                    </h5>
                    <span className="truncate text-xs text-fg-subtle" title={name}>
                      {name}
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  pill
                  disabled={disabled}
                  className="w-full group-hover:border-accent/60 group-hover:text-accent"
                  // The card handles navigation; keep the button visual but
                  // avoid double-firing.
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) openDnp(dnp.name);
                  }}
                >
                  {disabled ? "Up to date" : "Open"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

Dashboard.propTypes = {
  installedpackages: PropTypes.array.isRequired,
  chainData: PropTypes.array.isRequired,
  dappnodeStats: PropTypes.object.isRequired,
  dappnodeVolumes: PropTypes.array.isRequired,
};

const mapStateToProps = createStructuredSelector({
  chainData: getChainData,
  dappnodeStats: getDappnodeStats,
  dappnodeVolumes: getDappnodeVolumes,
  installedpackages: s.getFilteredPackages,
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = {
  fetchDappnodeStats,
};

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
