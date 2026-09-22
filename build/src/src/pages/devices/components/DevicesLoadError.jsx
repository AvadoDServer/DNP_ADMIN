import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
// Components
import { EmptyState } from "./DevicesPresentation";

// Matches the message services/devices/sagas.js records when the VPN
// package's listDevices RPC isn't registered.
const VPN_NOT_INSTALLED = /VPN package is not installed/i;

/**
 * Replaces the generic "Could not load devices" error for this page. When
 * the cause is a missing VPN package, point people at installing Remote
 * Connect instead of showing a bare error message; any other error keeps
 * its message, shown with the standard danger-tone empty state.
 */
const DevicesLoadError = ({ loadingError }) => {
  const history = useHistory();

  if (VPN_NOT_INSTALLED.test(loadingError || "")) {
    return (
      <Card padding="lg" className="mx-auto max-w-md text-center">
        <div className="font-semibold text-fg">Remote access isn't set up</div>
        <p className="mt-2 text-sm text-fg-muted">
          Install Remote Connect to reach your AVADO securely when you're away
          from home.
        </p>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() =>
            history.push("/installer/remoteconnect.avado.dnp.dappnode.eth")
          }
        >
          Install Remote Connect
        </Button>
      </Card>
    );
  }

  return (
    <EmptyState title="Could not load devices" tone="danger">
      {loadingError}
    </EmptyState>
  );
};

DevicesLoadError.propTypes = {
  loadingError: PropTypes.string
};

export default DevicesLoadError;
