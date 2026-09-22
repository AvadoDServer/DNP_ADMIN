import React from "react";
import PropTypes from "prop-types";

function DataList({ title, data }) {
  if (!data.length) return null;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </div>
      <ul className="flex flex-col gap-1 text-sm text-fg">
        {data.map((item, i) => (
          <li key={i} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

DataList.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.func, PropTypes.object])
  ).isRequired,
};

export default DataList;
