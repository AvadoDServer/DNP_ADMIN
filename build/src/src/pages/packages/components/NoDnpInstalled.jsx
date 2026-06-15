import React from "react";
import PropTypes from "prop-types";
import { useHistory } from "react-router-dom";
// UI kit
import Button from "components/ui/Button";
import { EmptyState } from "./PackagePresentation";

const NoDnpInstalled = ({ id, moduleName }) => {
  const history = useHistory();
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      }
      title={`${id} is not installed`}
      action={
        <Button
          variant="secondary"
          size="sm"
          className="capitalize"
          onClick={() => history.push("/" + moduleName)}
        >
          Back to {moduleName}
        </Button>
      }
    />
  );
};

NoDnpInstalled.propTypes = {
  id: PropTypes.string.isRequired,
  moduleName: PropTypes.string.isRequired,
};

export default NoDnpInstalled;
