import { confirm } from "components/ConfirmDialog";
import { shortNameCapitalized } from "utils/format";

// Shared with PackageViews/Controls.jsx (the Overview tab's controls panel)
// and AppPage's header overflow menu, so both read the same confirm copy.
//
// `consensus: true` (with `title`, the app's display title from appTitle())
// is for consensus clients: their data folder also holds validator keys and
// slashing protection, so the copy has to say that plainly instead of the
// generic "factory settings" text.
export default function confirmResetPackage(id, cb, { consensus = false, title } = {}) {
  const name = title || shortNameCapitalized(id);
  const text = consensus
    ? `This deletes ${name}'s data, including your validator keys and slashing protection. Back up your keys first. Only reset if AVADO support asked you to.`
    : `This will reload this package to its factory settings \n (only this package - all other installed AVADO packages will remain installed and keep their data). This action cannot be undone.`;
  confirm({
    title: `Reset ${shortNameCapitalized(id)}`,
    text,
    label: "Reset package",
    onClick: () => cb(id),
  });
}
