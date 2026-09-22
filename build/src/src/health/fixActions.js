import { togglePackage, restartPackage } from "pages/packages/actions";

export function runFixAction(finding, dispatch) {
  const { fix, appId } = finding || {};
  if (!fix || fix.kind !== "action" || !appId) return;
  if (fix.action === "startPackage") dispatch(togglePackage(appId));
  else if (fix.action === "restartPackage") dispatch(restartPackage(appId));
}
