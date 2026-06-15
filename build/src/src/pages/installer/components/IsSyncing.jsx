import React from "react";
import PropTypes from "prop-types";
// UI kit
import Card from "components/ui/Card";
import Badge from "components/ui/Badge";

function IsSyncing({ message }) {
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-fg-muted">
          Mainnet is syncing
        </h2>
        <Badge variant="warning" dot>
          Syncing
        </Badge>
      </div>
      <p className="text-sm text-fg-muted">
        Please wait while your mainnet full node syncs to install AVADO
        packages. In the meantime, you can still install packages using their
        IPFS hash.
      </p>
      {message && (
        <p className="truncate text-xs text-fg-subtle" title={message}>
          {message}
        </p>
      )}
    </Card>
  );
}

IsSyncing.propTypes = {
  message: PropTypes.string.isRequired,
};

export default IsSyncing;
