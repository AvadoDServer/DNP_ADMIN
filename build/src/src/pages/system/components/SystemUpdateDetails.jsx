import React from "react";
import PropTypes from "prop-types";
import { createStructuredSelector } from "reselect";
import { connect } from "react-redux";
import Linkify from "react-linkify";
import DependencyList from "pages/installer/components/InstallCardComponents/DependencyList";
// Actions
import { updateCore } from "services/coreUpdate/actions";
// Selectors
import { getCoreDeps, getCoreManifest } from "services/coreUpdate/selectors";
import { getIsLoadingStrictById } from "services/loadingStatus/selectors";
import { loadingId as loadingIdCoreUpdate } from "services/coreUpdate/data";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
// Components
import { LoadingState, Callout } from "./SystemPresentation";

function OnInstallAlert({ manifest }) {
  const { onInstall } = (manifest || {}).warnings || {};
  if (!onInstall) return null;
  return (
    <Callout tone="warning">
      <Linkify>{onInstall}</Linkify>
    </Callout>
  );
}

const SystemUpdateDetails = ({
  coreDeps,
  coreManifest,
  isLoading,
  updateCore
}) => {
  /* If loading, return a loading animation */
  if (isLoading) return <LoadingState label="Checking core version…" />;
  /* If no deps, don't show the card */
  if (!coreDeps.length) return null;

  const coreChangelog = (coreManifest || {}).changelog;
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-bold uppercase tracking-wider text-fg-muted">
          Core {coreManifest.version}
        </div>
        {coreChangelog && (
          <div className="whitespace-pre-line text-sm leading-relaxed text-fg-muted">
            <Linkify>{coreChangelog}</Linkify>
          </div>
        )}
        <OnInstallAlert manifest={coreManifest} />
      </div>

      {/* Dedicated per core version update and warnings */}
      <div className="border-t border-border pt-5">
        <DependencyList deps={coreDeps} />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={updateCore}>
          Update
        </Button>
      </div>
    </Card>
  );
};

SystemUpdateDetails.propTypes = {
  coreDeps: PropTypes.array.isRequired,
  coreManifest: PropTypes.object
};

// Container

const mapStateToProps = createStructuredSelector({
  coreDeps: getCoreDeps,
  coreManifest: getCoreManifest,
  isLoading: getIsLoadingStrictById(loadingIdCoreUpdate)
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = { updateCore };

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SystemUpdateDetails);
