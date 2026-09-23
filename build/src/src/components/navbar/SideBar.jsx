import logo from "img/avado-logo-v1.1.svg";
import { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import { NavLink, useLocation } from "react-router-dom";
import { createSelector, createStructuredSelector } from "reselect";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { useMode } from "settings/ModeProvider";
import { visibleNavItems } from "settings/visibility";
import { sidenavItems } from "./navbarItems";
import "./sidebar.css";

if (!Array.isArray(sidenavItems)) throw Error("sidenavItems must be an array");


// The sidebar is kept exclusively in this component state
// In order to avoid the App or redux to be aware of the
// sidebar state while allowing the tobar to toggle the sidebar
// Both components will communicate through window events
const toggleSideNavEvent = "toggleSideNavEvent";
export function toggleSideNav() {
  window.dispatchEvent(new Event(toggleSideNavEvent));
}


// Package lists
export const getFilteredPackages = createSelector(
  getDnpInstalled,
  _packages => _packages.filter(p => p.name !== "core.dnp.dappnode.eth")
);

const SideBar = ({
  dnps = [] }
) => {
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(window.innerWidth);

  const sidebarEl = useRef(null);
  const location = useLocation();
  const { mode } = useMode();

  function toggleSideNav() {
    setCollapsed(!collapsed);
  }
  function collapseSideNav() {
    setCollapsed(true);
  }

  useEffect(() => {
    window.addEventListener(toggleSideNavEvent, toggleSideNav);
    return () => {
      window.removeEventListener(toggleSideNavEvent, toggleSideNav);
    };
  }, []);

  // Below 1024 px the sidebar is an off-canvas drawer: close it whenever the
  // route changes, so navigating (a link inside a page, browser back/forward,
  // a redirect) never leaves it open over the new page.
  useEffect(() => {
    setCollapsed(true);
  }, [location.pathname]);

  useEffect(() => {
    // Always collapse the navbar when crossing the breakpoint, going from big to small
    function onWindowResize() {
      const breakPointPx = getBreakPointPx();
      if (width > breakPointPx && window.innerWidth <= breakPointPx)
        collapseSideNav();
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", onWindowResize);
    return () => {
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  useEffect(() => {
    if (collapsed) return; // Prevent unnecessary listeners
    function handleMouseDown(e) {
      if (!sidebarEl.current.contains(e.target)) setCollapsed(true);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [collapsed]);

  const filteredSidenavItems = visibleNavItems(sidenavItems, {
    mode,
    installedNames: dnps.map(dnp => dnp.name),
  });

  return (
    <>
      {/* Off-canvas overlay, below 1024 px only (see .sidebar-overlay / the
          sidebar's own breakpoint in layout.css). Tapping it closes the sidebar. */}
      {!collapsed && (
        <div
          className="sidebar-overlay"
          data-testid="sidebar-overlay"
          aria-hidden="true"
          onClick={collapseSideNav}
        />
      )}
      <div id="sidebar" ref={sidebarEl} className={collapsed ? "collapsed" : ""}>
        <NavLink className="sidenav-item top" to={"/"} onClick={collapseSideNav}>
          <img className="sidebar-logo header" src={logo} alt="logo" />
        </NavLink>

        <div className="nav">
          <div className="sidenav-section-label">Menu</div>

          {filteredSidenavItems.map(item => (
            <NavLink
              exact
              key={item.name}
              className="sidenav-item selectable"
              onClick={collapseSideNav}
              to={item.href}
            >
              <item.icon scale={0.8} />
              <span className="name svg-text">{item.name}</span>
            </NavLink>
          ))}
        </div>

        {/* spacer keeps the funded-by section at the bottom (if possible) */}
        <div className="spacer" />
        {/* REACT_APP_VERSION is only set by getVersionData.sh during the Docker
            build (yarn build run straight from the repo, e.g. a preview build,
            never sees it) — hide the line rather than show a bare "Version". */}
        {process.env.REACT_APP_VERSION && (
          <div className="sidebar-version">Version {process.env.REACT_APP_VERSION}</div>
        )}
      </div>
    </>
  );
}

// Utility

function getBreakPointPx() {
  const breakPointRem = parseFloat(
    getComputedStyle(document.body).getPropertyValue("--sidebar-breakpoint")
  );
  const baseDocumentFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );
  return breakPointRem * baseDocumentFontSize;
}


const mapStateToProps = createStructuredSelector({
  dnps: getFilteredPackages,
});

const mapDispatchToProps = {
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SideBar);
