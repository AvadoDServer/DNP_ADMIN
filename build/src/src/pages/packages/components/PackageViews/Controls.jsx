import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import * as action from "../../actions";
import { rootPath } from "../../data";
// UI kit
import Button from "components/ui/Button";
import Card from "components/ui/Card";
import { SectionHeader } from "../PackagePresentation";
// Confirm UI
import { confirm } from "components/ConfirmDialog";
import { shortNameCapitalized } from "utils/format";
import { toLowercase } from "utils/strings";
import confirmRemovePackage from "../confirmRemovePackage";
import confirmRestartPackage from "../confirmRestartPackage";

function PackageControls({
  dnp,
  togglePackage,
  restartPackage,
  restartPackageVolumes,
  resyncPackage,
  removePackage,
  showToggle = true,
  showRestart = true,
  showResync = false,
  showReset = true,
  showRemove = true,
  history,
}) {
  function confirmRemovePackageVolumes(id) {
    confirm({
      title: `Reset ${shortNameCapitalized(id)}`,
      text: `This will reload this package to its factory settings \n (only this package - all other installed AVADO packages will remain installed and keep their data). This action cannot be undone.`,
      label: "Reset package",
      onClick: () => restartPackageVolumes(id),
    });
  }

  function confirmResyncPackage(id) {
    confirm({
      title: `Resync ${shortNameCapitalized(id)}`,
      text: `This will delete the blockchain/chain data for this package and resync from scratch. Validator keys and configuration will be preserved. This action cannot be undone.`,
      label: "Resync chain data",
      onClick: () => resyncPackage(id),
    });
  }

  const state = toLowercase(dnp.state); // toLowercase always returns a string

  let actions = [];
  showToggle &&
    actions.push({
      name:
        state === "running" ? "Pause" : state === "exited" ? "Start" : "Toggle",
      text: "Toggle the state of the package from running to paused",
      action: () => togglePackage(dnp.name),
      availableForCore: false,
      type: "secondary",
    });
  showRestart &&
    actions.push({
      name: "Restart",
      text: "Restarting a package will interrupt the service during 1-10s but preserve its data",
      action: () => confirmRestartPackage(dnp.name, restartPackage),
      availableForCore: true,
      type: "secondary",
    });
  showResync &&
    actions.push({
      name: "Resync",
      text: "Resyncs the blockchain data from scratch while preserving validator keys and configuration.",
      action: () => confirmResyncPackage(dnp.name),
      availableForCore: true,
      type: "warning",
    });
  showReset &&
    actions.push({
      name: "Reset",
      text: `Resets this package to its factory settings (all package data will be lost).`,
      action: () => confirmRemovePackageVolumes(dnp.name),
      availableForCore: true,
      type: "danger",
    });
  showRemove &&
    actions.push({
      name: "Remove ",
      text: "Deletes a package permanently.",
      // Back to the package list once it is gone; its own page no longer exists
      action: () =>
        confirmRemovePackage(dnp.name, (id, deleteVolumes) =>
          Promise.resolve(removePackage(id, deleteVolumes)).then(
            () => history && history.push(rootPath),
            () => {} // the toast already reported the error
          )
        ),
      availableForCore: false,
      type: "danger",
    });

  // Map the legacy action "type" onto design-system Button variants.
  const VARIANT = {
    secondary: "secondary",
    warning: "outline",
    danger: "danger",
  };

  return (
    <section>
      <SectionHeader title="Controls" />
      <Card padding="none">
        <ul className="divide-y divide-border">
          {actions.map(({ name, text, type, action }) => (
            <li
              key={name}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold text-fg">{name.trim()}</div>
                <p className="mt-0.5 text-sm text-fg-muted">{text}</p>
              </div>
              <Button
                variant={VARIANT[type] || "secondary"}
                size="sm"
                onClick={action}
                className="flex-shrink-0 sm:min-w-[7rem]"
              >
                {name.trim()}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

const mapStateToProps = null;

const mapDispatchToProps = {
  togglePackage: action.togglePackage,
  restartPackage: action.restartPackage,
  restartPackageVolumes: action.restartPackageVolumes,
  resyncPackage: action.resyncPackage,
  removePackage: action.removePackage,
};

export default withRouter(
  connect(mapStateToProps, mapDispatchToProps)(PackageControls)
);
