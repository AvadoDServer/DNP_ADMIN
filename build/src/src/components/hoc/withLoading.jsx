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

// `renderError` is optional: when given, it takes over rendering the error
// state entirely (e.g. to show a friendlier, situation-specific empty state
// instead of the generic ErrorView). Every other caller of withLoading keeps
// the default ErrorView behavior.
export default function withLoading(loadingId, loadingMsg, renderError) {
  return function(WrappedComponent) {
    class WithLoading extends React.Component {
      render() {
        const { isLoading, loadingError, ...props } = this.props;
        if (isLoading) {
          return <Loading msg={`Loading ${loadingMsg || loadingId}...`} />;
        }
        if (loadingError) {
          if (typeof renderError === "function") {
            return renderError(loadingError, props);
          }
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
