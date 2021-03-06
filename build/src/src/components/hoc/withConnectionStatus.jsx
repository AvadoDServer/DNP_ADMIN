import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { getDisplayName } from "./utilities";
import { getConnectionStatus } from "services/connectionStatus/selectors";
import Loading from "components/generic/Loading";
import Error from "components/generic/Error";

export default function withConnectionStatus(WrappedComponent) {
  class WithConnectionStatus extends React.Component {
    render() {
      const { isOpen, isNotAdmin, error } = this.props.connectionStatus || {};
      if (isOpen) {
        return <WrappedComponent {...this.props} />;
      } else if (isNotAdmin) {
        return <h1>You are not an admin</h1>;
      } else if (error) {
        return <Error msg={`Error connecting to DAppNode: ${error}`} />;
      } else {
        return <Loading msg={`Opening connection...`} />;
      }
    }
  }
  WithConnectionStatus.displayName = `WithConnectionStatus(${getDisplayName(
    WrappedComponent
  )})`;

  const mapStateToProps = createStructuredSelector({
    connectionStatus: getConnectionStatus
  });

  return connect(mapStateToProps)(WithConnectionStatus);
}
