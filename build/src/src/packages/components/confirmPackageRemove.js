import { confirmAlert } from "react-confirm-alert"; // Import
import "react-confirm-alert/src/react-confirm-alert.css"; // Import css
import { shortName } from "utils/format";

function shortNameCapitalized(name = "") {
  const _name = shortName(name);
  return _name.charAt(0).toUpperCase() + _name.slice(1);
}

export default function confirmPackageRemove(pkg, removePackageAction) {
  const name = shortNameCapitalized(pkg.name);
  confirmAlert({
    title: `Removing ${name}`,
    message: `This action cannot be undone. If you do NOT want to keep ${name}'s data, remove it permanently clicking the "Remove DNP + data" option.`,
    buttons: [
      {
        label: "Cancel",
        onClick: () => {}
      },
      {
        label: "Remove",
        onClick: () => removePackageAction(pkg, false)
      },
      {
        label: "Remove DNP + data",
        onClick: () => removePackageAction(pkg, true)
      }
    ]
  });
}