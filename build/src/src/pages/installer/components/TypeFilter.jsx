import React from "react";
import PropTypes from "prop-types";
import Button from "components/ui/Button";

function TypeFilter({ types, onTypeChange }) {
  if (Object.keys(types).length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-fg-muted">Filter by type:</span>
      {Object.entries(types).map(([type, checked]) => (
        <Button
          key={type}
          size="sm"
          pill
          variant={checked ? "primary" : "secondary"}
          onClick={() => onTypeChange(type)}
        >
          {type}
        </Button>
      ))}
    </div>
  );
}

/**
 * @param {object} types = {
 *   "library": true,
 *   "service": false
 * }
 */
TypeFilter.propTypes = {
  types: PropTypes.objectOf(PropTypes.bool.isRequired).isRequired,
  onTypeChange: PropTypes.func.isRequired,
};

export default TypeFilter;
