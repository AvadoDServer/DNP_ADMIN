import { confirm } from "components/ConfirmDialog";
import { shortNameCapitalized } from "utils/format";

// Shared with PackageViews/Controls.jsx (the Overview tab's controls panel)
// and AppPage's header overflow menu, so both read the same confirm copy.
export default function confirmResetPackage(id, cb) {
  confirm({
    title: `Reset ${shortNameCapitalized(id)}`,
    text: `This will reload this package to its factory settings \n (only this package - all other installed AVADO packages will remain installed and keep their data). This action cannot be undone.`,
    label: "Reset package",
    onClick: () => cb(id),
  });
}
