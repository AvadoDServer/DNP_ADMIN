import React from "react";
import { Route, Switch } from "react-router-dom";
import { rootPath, updatePath, title } from "../data";
// Components
import SystemHome from "./SystemHome";
import SystemUpdates from "./SystemUpdates";
import SystemStorage from "./SystemStorage";
import SystemHistory from "./SystemHistory";
import SystemUpdate from "./SystemUpdate";
import SystemTabs, { TAB_PATHS } from "./SystemTabs";
import AppPage from "pages/packages/components/AppPage";
import { PageHeader } from "components/ui/PageHeader";

const UPDATES_PATH = `${rootPath}/updates`;
const STORAGE_PATH = `${rootPath}/storage`;
const HISTORY_PATH = `${rootPath}/history`;

const SystemRoot = ({ location }) => (
  <>
    {/* One header for all four tab pages (not the core update flow at
        /system/update, or an individual core app page at /system/:id,
        which have their own). Each tab's own component used to render its
        own PageHeader too — title "System" under a per-tab eyebrow read
        backwards, and duplicated "System" on every tab. */}
    {TAB_PATHS.includes(location.pathname) && (
      <div className="animate-fade-in">
        <PageHeader title={title} subtitle="Updates, disk space and maintenance for your AVADO." />
        <SystemTabs />
      </div>
    )}
    {/* Use switch so only the first match is rendered. match.url = /system */}
    <Switch>
      <Route exact path={rootPath} component={SystemHome} />
      <Route path={UPDATES_PATH} component={SystemUpdates} />
      <Route path={STORAGE_PATH} component={SystemStorage} />
      <Route path={HISTORY_PATH} component={SystemHistory} />
      <Route path={rootPath + "/" + updatePath} component={SystemUpdate} />
      <Route path={rootPath + "/:id"} render={props => <AppPage {...props} isCore />} />
    </Switch>
  </>
);

// Container

// Use `compose` from "redux" if you need multiple HOC
export default SystemRoot;
