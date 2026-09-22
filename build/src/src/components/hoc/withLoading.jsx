import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { getDisplayName } from "./utilities";
import {
  getIsLoadingById,
  getLoadingErrorById
} from "services/loadingStatus/selectors";
import Loading from "components/generic/Loading";
import ErrorView from "components/generic/Error";

export default function withLoading(loadingId, loadingMsg) {
  return function(WrappedComponent) {
    class WithLoading extends React.Component {
      render() {
        const { isLoading, loadingError, ...props } = this.props;
        if (isLoading) {
          return <Loading msg={`Loading ${loadingMsg || loadingId}...`} />;
        }
        if (loadingError) {
          return (
            <ErrorView
              msg={`Could not load ${loadingMsg || loadingId}: ${loadingError}`}
            />
          );
        }
        return <WrappedComponent {...props} />;
      }
    }
    WithLoading.displayName = `WithLoading(${getDisplayName(
      WrappedComponent
    )})`;

    const mapStateToProps = createStructuredSelector({
      isLoading: getIsLoadingById(loadingId),
      loadingError: getLoadingErrorById(loadingId)
    });

    return connect(mapStateToProps)(WithLoading);
  };
}
