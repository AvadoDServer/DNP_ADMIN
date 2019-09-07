import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { sidenavItems, fundedBy } from "./navbarItems";
import logo from "img/avado-logo-v1.1.svg";
import "./sidebar.css";

if (!Array.isArray(sidenavItems)) throw Error("sidenavItems must be an array");
if (!Array.isArray(fundedBy)) throw Error("fundedBy must be an array");

// The sidebar is kept exclusively in this component state
// In order to avoid the App or redux to be aware of the
// sidebar state while allowing the tobar to toggle the sidebar
// Both components will communicate through window events
const toggleSideNavEvent = "toggleSideNavEvent";
export function toggleSideNav() {
  window.dispatchEvent(new Event(toggleSideNavEvent));
}

export default function SideBar() {
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(window.innerWidth);

  const sidebarEl = useRef(null);

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

  return (
    <div id="sidebar" ref={sidebarEl} className={collapsed ? "collapsed" : ""}>
      <NavLink className="sidenav-item top" to={"/"} onClick={collapseSideNav}>
        <img className="sidebar-logo header" src={logo} alt="logo" />
      </NavLink>

      <div className="nav">
        {/* <div className="sidenav-item">
          <div className="subheader">ADMIN UI</div>
        </div> */}

        {sidenavItems.map(item => (
          <NavLink
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
    <div className="sidenav-item">Version {process.env.REACT_APP_VERSION}</div>
      {/* <div className="funded-by">
        <div className="funded-by-text">SUPPORTED BY</div>
        <div className="funded-by-logos">
          {fundedBy.map((item, i) => (
            <a key={i} href={item.link}>
              <img
                src={item.logo}
                className="img-fluid funded-by-logo"
                alt="logo"
                data-toggle="tooltip"
                data-placement="top"
                title={item.text}
                data-delay="300"
              />
            </a>
          ))}
        </div>
      </div> */}
    </div>
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
