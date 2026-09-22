import { restartPackage } from "pages/packages/actions";

// Note: findings never use "startPackage" (which dispatches togglePackage and
// stops a running container / throws on state "dead"). appStopped's fix uses
// "restartPackage" instead, since restart (stop/rm/up) is idempotent and
// handles every stopped state, including "dead".
export function runFixAction(finding, dispatch) {
  const { fix, appId } = finding || {};
  if (!fix || fix.kind !== "action" || !appId) return;
  if (fix.action === "restartPackage") dispatch(restartPackage(appId));
}
