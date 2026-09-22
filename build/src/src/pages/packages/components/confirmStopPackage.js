import { confirm } from "components/ConfirmDialog";
import { shortNameCapitalized } from "utils/format";

// Used by AppPage's header overflow menu (non-core apps only) to confirm
// stopping a running app. Starting is not destructive and needs no confirm,
// so it is not routed through here.
export default function confirmStopPackage(id, cb, title) {
  const name = title || shortNameCapitalized(id);
  confirm({
    title: `Stop ${name}?`,
    text: "While it is stopped, anything that depends on it will not work — including your validators, if this is a client, which will miss attestations until you start it again.",
    buttons: [{ label: "Stop", onClick: () => cb(id) }],
  });
}
