import React from "react";
import { useHistory } from "react-router-dom";
import { rootPath as installerRootPath } from "pages/installer";
// UI kit
import Button from "components/ui/Button";
import { EmptyState } from "./PackagePresentation";

const NoPackagesYet = () => {
  const history = useHistory();
  return (
    <EmptyState
      title="No DApps installed yet"
      action={
        <Button variant="primary" size="sm" onClick={() => history.push(installerRootPath)}>
          Browse the DappStore
        </Button>
      }
    >
      Install your first AVADO package from the DappStore to get started.
    </EmptyState>
  );
};

export default NoPackagesYet;
