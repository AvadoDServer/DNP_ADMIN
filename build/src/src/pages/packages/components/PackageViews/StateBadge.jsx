import React from "react";
import PropTypes from "prop-types";
import Badge from "components/ui/Badge";

const VARIANT = {
  running: "success",
  exited: "danger",
};

function StateBadge({ state }) {
  const variant = VARIANT[state] || "neutral";
  return (
    <Badge variant={variant} dot className="capitalize">
      {state}
    </Badge>
  );
}

StateBadge.propTypes = {
  state: PropTypes.string.isRequired,
};

export default StateBadge;
