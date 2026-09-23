import React from "react";
import { Route } from "react-router-dom";
import { rootPath } from "../data";
// Components
import InstallerHome from "./InstallerHome";
import InstallerSinglePkg from "./InstallerSinglePkg";
import InstallerByName from "./InstallerByName";
// Modules

const InstallerRoot = () => (
  <>
    <Route exact path={rootPath} component={InstallerHome} />
    <Route exact path={rootPath + "/custom/:id"} component={InstallerHome} />
    {/* Using :id+ so it matches only id.length > 0 */}
    <Route
      exact
      path={rootPath + "/:id+"}
      render={props => (
        <InstallerByName {...props}>
          <InstallerSinglePkg {...props} />
        </InstallerByName>
      )}
    />
  </>
);

export default InstallerRoot;
