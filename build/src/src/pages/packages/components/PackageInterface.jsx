import PropTypes from "prop-types";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import * as s from "../selectors";
// Components
import NoDnpInstalled from "./NoDnpInstalled";
import Controls from "./PackageViews/Controls";
import Details from "./PackageViews/Details";
import Envs from "./PackageViews/Envs";
import FileManager from "./PackageViews/FileManager";
import Logs from "./PackageViews/Logs";
// Components
import { PageHeader, LoadingState, EmptyState } from "./PackagePresentation";
// Selectors
import {
    getIsLoading,
    getLoadingError,
} from "services/loadingStatus/selectors";

const PackageInterface = ({
  dnp,
  id,
  moduleName,
  areThereDnps,
  loading,
  error,
  showControls = true,
  showReset,
  showRemove,
}) => {
  const isTeku = dnp && dnp.name && dnp.name.includes("teku");
  return (
    <>
      {dnp ? (
        <div className="animate-fade-in flex flex-col gap-2">
          <PageHeader title={dnp.title || dnp.id}>
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              {moduleName}
            </span>
          </PageHeader>
          {showControls && (
            <Controls
              dnp={dnp}
              showReset={showReset}
              showRemove={showRemove}
              showResync={isTeku}
            />
          )}
          <Details dnp={dnp} />
          <Envs dnp={dnp} />
          <FileManager dnp={dnp} />
          <Logs id={dnp.name} />
        </div>
      ) : loading ? (
        <LoadingState label="Loading installed package…" />
      ) : error ? (
        <EmptyState
          tone="danger"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          }
          title="Could not load package"
        >
          {String(error)}
        </EmptyState>
      ) : areThereDnps ? (
        <NoDnpInstalled id={id} moduleName={moduleName} />
      ) : null}
    </>
  );
};

PackageInterface.propTypes = {
  dnp: PropTypes.object,
  id: PropTypes.string,
  moduleName: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
};

// Container

const mapStateToProps = createStructuredSelector({
  dnp: s.getDnp,
  // id and moduleName are parsed from the url at the selector (with the router state)
  id: s.getUrlId,
  moduleName: s.getModuleName,
  areThereDnps: s.areThereDnps,
  loadingDnps: getIsLoading.dnpInstalled,
  loading: getIsLoading.dnpInstalled,
  error: getLoadingError.dnpInstalled,
});

const mapDispatchToProps = null;

export default connect(mapStateToProps, mapDispatchToProps)(PackageInterface);
