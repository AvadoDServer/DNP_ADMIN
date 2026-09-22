import React from "react";
// Icons
import ContactSupport from "Icons/ContactSupport";
import { NavLink } from "react-router-dom";
import { rootPath as reportPath } from "pages/troubleshoot";

const Report = () => {
  return (
    <NavLink
      to={reportPath}
      title="Support"
      aria-label="Support"
      className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg focus:outline-none focus-visible:shadow-focus"
    >
      <ContactSupport />
    </NavLink>
  );
};

export default Report;
