import React from "react";
// Icons
import ContactSupport from "Icons/ContactSupport";
import { NavLink } from "react-router-dom";
import { rootPath as reportPath } from "pages/troubleshoot";

const Report = () => {
  return (
    <NavLink
      to={reportPath}
      title="Help"
      aria-label="Help"
      className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg focus:outline-none focus-visible:shadow-focus lg:w-auto lg:px-2.5"
    >
      <ContactSupport />
      <span className="topbar-label">Help</span>
    </NavLink>
  );
};

export default Report;
