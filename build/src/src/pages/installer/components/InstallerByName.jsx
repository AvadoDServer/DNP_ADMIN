import React, { useEffect } from "react";
import { rootPath } from "../data";
import { useHealth } from "health/HealthProvider";
import { storeHashFor, isPlainName } from "../helpers/storeHash";
import Spinner from "components/ui/Spinner";

/**
 * Route wrapper for /installer/:id. A plain package name is swapped for the
 * DappStore catalogue's IPFS hash (see helpers/storeHash), so installs and
 * updates don't depend on ENS / an execution client. While the catalogue is
 * still loading we wait for it; if it failed or doesn't list the package,
 * the name is used as before.
 */
export function InstallerByNameView({ id, storePackages, storeStatus, history, children }) {
  const hash = storeHashFor(id, storePackages);

  useEffect(() => {
    if (hash) history.replace(`${rootPath}/${encodeURIComponent(hash)}`);
  }, [hash, history]);

  if (hash || (isPlainName(id) && storeStatus === "loading")) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner size="sm" />
        Looking up the package…
      </p>
    );
  }
  return children;
}

export default function InstallerByName({ match, history, children }) {
  const { storePackages, sources } = useHealth();
  const id = decodeURIComponent((match && match.params && match.params.id) || "");
  return (
    <InstallerByNameView id={id} storePackages={storePackages} storeStatus={sources && sources.updates} history={history}>
      {children}
    </InstallerByNameView>
  );
}
