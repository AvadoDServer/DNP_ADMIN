import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import ErrorBoundary from "components/generic/ErrorBoundary";
import NotFound from "components/NotFound";

export const REDIRECTS = [
  { from: "/", to: "/dashboard", exact: true },
  { from: "/troubleshoot", to: "/help" },
  { from: "/support", to: "/help" },
  { from: "/activity", to: "/system/history" },
];

export function AppRoutes({ pages }) {
  return (
    <Switch>
      {REDIRECTS.map(r => <Redirect key={r.from} exact={r.exact} from={r.from} to={r.to} />)}
      {/* `sensitive` keeps these legacy, capitalized paths from also matching (and
          shadowing) their own lowercase redirect targets below, since react-router
          v5 path matching is case-insensitive by default. */}
      <Route sensitive path="/Packages/:rest+" render={({ match, location }) => <Redirect to={`/packages/${match.params.rest}${location.search}`} />} />
      <Route sensitive path="/System/:rest+" render={({ match, location }) => <Redirect to={`/system/${match.params.rest}${location.search}`} />} />
      {Object.values(pages).map(({ RootComponent, rootPath }) => (
        <Route
          key={rootPath}
          path={rootPath}
          render={props => (
            <ErrorBoundary>
              <RootComponent {...props} />
            </ErrorBoundary>
          )}
        />
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}
