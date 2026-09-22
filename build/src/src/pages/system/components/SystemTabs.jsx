import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { useHistory, useLocation } from "react-router-dom";
import { useHealth } from "health/HealthProvider";
import { getCoreUpdateAvailable } from "services/coreUpdate/selectors";
import Tabs from "components/ui/Tabs";
import { rootPath } from "../data";

export const TAB_DEFS = [
  { id: "overview", label: "Overview", path: rootPath },
  { id: "updates", label: "Updates", path: `${rootPath}/updates` },
  { id: "storage", label: "Storage", path: `${rootPath}/storage` },
  { id: "history", label: "History", path: `${rootPath}/history` },
];

/** Tab paths SystemRoot shows this bar on — the four tab pages only, not the
 * core update flow or an individual core app page. */
export const TAB_PATHS = TAB_DEFS.map(t => t.path);

// The <Route>s these paths lead to are matched case-insensitively by
// react-router v5 by default (no `sensitive` prop), so pathname comparisons
// here must be too, or the tab bar / active-tab highlight can silently
// disagree with which page is actually showing (e.g. "/system/Updates").
const isSamePath = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
export const isTabPath = pathname => TAB_PATHS.some(p => isSamePath(p, pathname));

function SystemTabs({ coreUpdateAvailable }) {
  const history = useHistory();
  const location = useLocation();
  const { updates } = useHealth();
  const updateCount = Object.keys(updates || {}).length + (coreUpdateAvailable ? 1 : 0);

  const tabs = TAB_DEFS.map(t => ({
    id: t.id,
    label: t.label,
    ...(t.id === "updates" && updateCount ? { badge: updateCount } : {}),
  }));

  const activeTab = TAB_DEFS.find(t => isSamePath(t.path, location.pathname)) || TAB_DEFS[0];

  return (
    <Tabs
      tabs={tabs}
      active={activeTab.id}
      onChange={id => {
        const target = TAB_DEFS.find(t => t.id === id);
        if (target) history.push(target.path);
      }}
      className="mb-6"
    />
  );
}

const mapStateToProps = createStructuredSelector({
  coreUpdateAvailable: getCoreUpdateAvailable,
});

export default connect(mapStateToProps)(SystemTabs);
export { SystemTabs };
