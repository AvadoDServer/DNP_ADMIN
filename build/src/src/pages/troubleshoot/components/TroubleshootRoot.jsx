import React from "react";
import { Route, Switch } from "react-router-dom";
import { rootPath } from "../data";
import HelpHome from "./HelpHome";
import HelpTopic from "./HelpTopic";

export default function TroubleshootRoot() {
  return (
    <Switch>
      <Route exact path={rootPath} component={HelpHome} />
      <Route path={rootPath + "/:topic"} component={HelpTopic} />
    </Switch>
  );
}
