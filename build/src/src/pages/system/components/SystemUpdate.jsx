import React from "react";
import { createStructuredSelector } from "reselect";
import { connect } from "react-redux";
import { title } from "../data";
// Modules
import installer from "pages/installer";
// Selectors
import { getProgressLogsByDnp } from "services/isInstallingLogs/selectors";
import { coreName } from "services/coreUpdate/data";
// Components
import SystemUpdateDetails from "./SystemUpdateDetails";
import { PageHeader } from "./SystemPresentation";

const SystemUpdate = ({ coreProgressLogs }) => (
  <div className="animate-fade-in">
    <PageHeader
      title={title}
      eyebrow="Update"
      subtitle="Review and approve the available AVADO core update."
    />

    {/* This component will automatically hide if logs are empty */}
    <installer.components.ProgressLogs progressLogs={coreProgressLogs} />

    <SystemUpdateDetails />
  </div>
);

// Container

const mapStateToProps = createStructuredSelector({
  coreProgressLogs: state => getProgressLogsByDnp(state, coreName)
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = null;

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SystemUpdate);
