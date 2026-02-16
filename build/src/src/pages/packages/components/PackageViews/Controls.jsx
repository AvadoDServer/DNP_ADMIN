import { connect } from "react-redux";
import * as action from "../../actions";
// Components
import Button from "components/Button";
import CardList from "components/CardList";
import SubTitle from "components/SubTitle";
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
      action: () => confirmRemovePackage(dnp.name, removePackage),
      availableForCore: false,
      type: "danger",
    });

  // Table style -> Removes the space below the table, only for tables in cards
  return (
    <>
      <SubTitle>Controls</SubTitle>
      <CardList>
        {actions
          //   .filter(action => action.availableForCore || !dnp.isCore)
          .map(({ name, text, type, action }) => (
            <div key={name} className="control-item">
              <div>
                <strong>{name}</strong>
                <div>{text}</div>
              </div>
              <Button variant={`outline-${type}`} onClick={action}>
                {name}
              </Button>
            </div>
          ))}
      </CardList>
    </>
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

export default connect(mapStateToProps, mapDispatchToProps)(PackageControls);
