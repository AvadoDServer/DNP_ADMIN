import React from "react";

const Soft = ({ children, ...props }) => (
  <span className="text-fg-subtle" {...props}>
    {children}
  </span>
);

export default Soft;
