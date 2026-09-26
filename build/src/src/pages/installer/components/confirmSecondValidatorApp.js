import { confirm } from "components/ConfirmDialog";
import { NETWORKS } from "health/clients";
import { appTitle } from "health/rules/apps";
import { ONE_APP_PER_KEY, KEY_MOVE_WAIT_MINUTES, joinNames } from "health/rules/validators";

// Used by InstallerSinglePkg before a new install (never an update) of `app`
// ({ name, manifest }), an app that can hold validator keys, when `others`
// (installed packages) already can on the same network. Same message as the
// twoValidatorClients finding.
export default function confirmSecondValidatorApp({ app, network, others }, cb) {
  const title = appTitle(app);
  const names = joinNames(others.map(appTitle));
  const networkLabel = (NETWORKS[network] && NETWORKS[network].label) || network;
  confirm({
    title: `${names} ${others.length === 1 ? "is" : "are"} already installed for ${networkLabel}`,
    text: `${ONE_APP_PER_KEY}\n\nMoving your validators to ${title}? Install it, then remove them from ${names}, wait at least ${KEY_MOVE_WAIT_MINUTES} minutes, and only then import them into ${title}.`,
    buttons: [{ label: "Install", onClick: cb }],
  });
}
