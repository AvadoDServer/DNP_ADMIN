import { confirm } from "components/ConfirmDialog";
import { appTitle } from "health/rules/apps";
import { appDiskUse, formatDockerSize } from "health/rules/storage";

// "Free up space" on a consensus client (DAPPMANAGER resetBeaconData): shared
// by the Home finding, System > Storage and the app page.
export default function confirmResetBeaconData(pkg, cb) {
  const title = appTitle(pkg);
  confirm({
    title: `Free up space on ${title}`,
    text: [
      `This deletes ${title}'s chain data (${formatDockerSize(appDiskUse(pkg))}) and downloads a recent checkpoint instead.`,
      "Kept: your validator keys, slashing protection and settings.",
      `Your validators are offline for about 15 to 30 minutes while ${title} syncs again. Keep your AVADO on.`,
    ].join("\n"),
    label: "Free up space",
    onClick: () => cb(pkg.name),
  });
}
