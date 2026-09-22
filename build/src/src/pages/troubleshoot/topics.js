export const TOPICS = [
  {
    id: "setup", title: "Validator setup", when: "Choosing clients, importing keys, fee recipient.",
    findingTopics: ["setup"],
    steps: [
      { title: "Install an execution client and a consensus client", body: "Your validator needs both, on the same network. Staking setup checks which ones you have.", action: { label: "Open Staking setup", to: "/staking" } },
      { title: "Import your validator keys", body: "Open your consensus client's Setup tab and use its import screen. Import each key on one machine only: running the same key twice gets you slashed." },
      { title: "Set your fee recipient", body: "In the same Setup tab, set the Ethereum address that receives transaction tips. Without it you miss that part of your rewards." },
      { title: "Check the result", body: "Come back to Home. When everything is in place the setup findings disappear.", action: { label: "Go to Home", to: "/dashboard" } },
    ],
  },
  {
    id: "sync", title: "Not syncing or not working", when: "An app is stopped, restarting, or behind the chain.",
    findingTopics: ["sync", "core"],
    steps: [
      { title: "Look at the findings above", body: "They show which app is affected and offer a fix." },
      { title: "Read the app's logs", body: "Open the app, then the Logs tab. The last error before a restart is usually the cause." },
      { title: "Restart the app", body: "Use Restart on the app's Overview tab. Most transient problems clear with a restart." },
      { title: "Check disk and peers", body: "A full disk or very few peers stop clients from following the chain.", action: { label: "Open Storage", to: "/system/storage" } },
    ],
  },
  {
    id: "attestations", title: "Missed attestations", when: "Rewards lower than expected, or attestations missed.",
    findingTopics: ["attestations", "sync"],
    steps: [
      { title: "Install monitoring if you haven't", body: "The monitoring package lets your AVADO count missed attestations and show them here.", action: { label: "Install monitoring", to: "/installer/grafana.avado.dappnode.eth" } },
      { title: "Make sure both clients are synced", body: "A consensus client that follows an unsynced execution client cannot attest correctly." },
      { title: "Check peers and ports", body: "Fewer than 10 peers makes attestations arrive late.", action: { label: "Network help", to: "/help/access" } },
      { title: "Check that the box clock is right", body: "Attestations are time-sensitive. Reboot the box if its time was wrong after a power cut." },
    ],
  },
  {
    id: "updates", title: "Updates and versions", when: "An update didn't install, or you're not sure what version you run.",
    findingTopics: ["updates"],
    steps: [
      { title: "See what can be updated", body: "System → Updates lists every app with a newer version.", action: { label: "Open Updates", to: "/system/updates" } },
      { title: "Keep automatic updates on for clients", body: "Clients must update before network upgrades. Automatic updates install them for you." },
      { title: "If an update seems stuck", body: "Wait 15 minutes, then reload this page. If the app is still on the old version, restart it and try the update again." },
    ],
  },
  {
    id: "access", title: "Access and network", when: "Can't reach my.ava.do, Wi-Fi, Remote Connect, ports.",
    findingTopics: ["access"],
    steps: [
      { title: "Reaching your AVADO at home", body: "Use http://my.ava.do from a device on the same network, or the AVADO's Wi-Fi hotspot." },
      { title: "Open the peer-to-peer ports", body: "Turn on UPnP in your router, or forward the ports listed on each client's Overview tab to your AVADO's internal IP." },
      { title: "Reaching it from away", body: "Remote Connect gives you secure access from anywhere.", action: { label: "Open Remote Connect", to: "/packages/remoteconnect.avado.dnp.dappnode.eth" } },
    ],
  },
  {
    id: "storage", title: "Disk space", when: "Disk almost full, or an app uses a lot of space.",
    findingTopics: ["storage"],
    steps: [
      { title: "See what uses the space", body: "System → Storage lists each app's disk use.", action: { label: "Open Storage", to: "/system/storage" } },
      { title: "Clean up unused images", body: "Old versions of apps stay on disk after updates. Cleaning them up is safe." },
      { title: "Shrink an execution client", body: "Resetting an execution client's data makes it sync again and frees space. Never reset a consensus client yourself: it holds your validator keys." },
    ],
  },
];
