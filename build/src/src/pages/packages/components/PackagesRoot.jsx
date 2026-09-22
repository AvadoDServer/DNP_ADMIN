import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import { rootPath } from "../data";
import PackagesHome from "./PackagesHome";
import AppPage from "./AppPage";

const PackagesRoot = () => (
  <Switch>
    <Route exact path={rootPath} component={PackagesHome} />
    <Route exact path={rootPath + "/:id/detail"} render={({ match }) => <Redirect to={`${rootPath}/${match.params.id}?tab=overview`} />} />
    <Route exact path={rootPath + "/:id"} component={AppPage} />
  </Switch>
);

export default PackagesRoot;
