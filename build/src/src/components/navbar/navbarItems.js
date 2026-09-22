// Icons
import Dashboard from "Icons/Dashboard";
import Activity from "Icons/Activity";
import Chain from "Icons/Chain";
import Devices from "Icons/Devices";
import Folder from "Icons/Folder";
import NewFolder from "Icons/NewFolder";
import Settings from "Icons/Settings";
import Priority from "Icons/Priority";

export const sidenavItems = [
  {
    name: "Home",
    href: "/dashboard",
    icon: Dashboard
  },
  {
    name: "DappStore",
    href: "/installer",
    icon: NewFolder
  },

  {
    name: "My DApps",
    href: "/packages",
    icon: Folder
  },
  {
    name: "Staking setup",
    href: "/staking",
    icon: Chain
  },
  {
    name: "Connect (VPN)",
    href: "/devices",
    icon: Devices,
    package: "vpn.dnp.dappnode.eth",
    hideif: ["remoteconnect.avado.dnp.dappnode.eth"]
  },
  {
    name: "Remote Connect",
    href: "/packages/remoteconnect.avado.dnp.dappnode.eth",
    icon: Devices,
    package: "remoteconnect.avado.dnp.dappnode.eth",
  },
  {
    name: "Priority",
    href: "/priority",
    icon: Priority
  },
  {
    name: "Help",
    href: "/help",
    icon: Activity
  },

  {
    name: "System",
    href: "/system",
    icon: Settings
  }

  //   {
  //     name: "Activity",
  //     href: "/activity",
  //     icon: Activity
  //   },

  //   {
  //     name: "Sdk",
  //     href: "/sdk",
  //     icon: Build
  //   }
];
