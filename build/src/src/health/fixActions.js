import { restartPackage, resetBeaconData } from "pages/packages/actions";
import confirmResetBeaconData from "pages/packages/components/confirmResetBeaconData";

// Note: findings never use "startPackage" (which dispatches togglePackage and
// stops a running container / throws on state "dead"). appStopped's fix uses
// "restartPackage" instead, since restart (stop/rm/up) is idempotent and
// handles every stopped state, including "dead".
//
// "resetBeaconData" deletes data, so it never dispatches without the confirm
// dialog; it needs the package (for its name and size), found in `packages`.
export function runFixAction(finding, dispatch, packages) {
  const { fix, appId } = finding || {};
  if (!fix || fix.kind !== "action" || !appId) return;
  if (fix.action === "restartPackage") dispatch(restartPackage(appId));
  if (fix.action === "resetBeaconData") {
    const pkg = (packages || []).find(p => p && p.name === appId);
    if (pkg) confirmResetBeaconData(pkg, id => dispatch(resetBeaconData(id)));
  }
}
