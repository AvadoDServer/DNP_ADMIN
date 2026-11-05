// Dev-only (yarn dev): installed packages for checking the Admin package pages
// of the newer AVADO apps, values taken from their dappnode_package.json.
// One is installed from an IPFS hash, so its version is a long "/ipfs/Qm..."
// string (it used to push the page wider than a phone screen).

const IPFS_HASH = "/ipfs/QmWb5Y5VJkB2h4f7dT9oQx3iV1rC8wZsN6pLmK4eHgA2uE";

const volume = (pkg, vol, size) => ({
  type: "volume",
  name: `${pkg.replace(/[.-]/g, "")}_${vol}`,
  path: `/var/lib/docker/volumes/${pkg.replace(/[.-]/g, "")}_${vol}/_data`,
  size,
});
const bind = path => ({ type: "bind", path });
const port = (n, type = "tcp") => ({ IP: "0.0.0.0", PrivatePort: n, PublicPort: n, Type: type });

function pkg({ name, version = "0.1.0", title, description, links, ports = [], volumes = [], envs, origin, state = "running" }) {
  return {
    name,
    isDnp: true,
    isCore: false,
    version,
    state,
    running: state === "running",
    ports,
    volumes,
    ...(envs ? { envs } : {}),
    manifest: { name, version, title, description, links, ...(origin ? { origin } : {}) },
  };
}

export const mockPackages = [
  pkg({
    name: "bitcoincore.avado.dnp.dappnode.eth",
    title: "Bitcoin Node",
    description:
      "Your own Bitcoin node (Bitcoin Core). It downloads and checks every Bitcoin block itself, so your wallet does not have to trust anyone else's server.",
    links: { OnboardingWizard: "http://bitcoincore.my.ava.do", HomePage: "https://bitcoincore.org" },
    ports: [port(8333)],
    volumes: [volume("bitcoincore.avado.dnp.dappnode.eth", "bitcoincore", "702.4GB")],
    envs: { MODE: "auto", PRUNE_GB: "10", FULL_NODE_MIN_FREE_GB: "1500", DBCACHE_MB: "1000" },
  }),
  pkg({
    name: "fulcrum.avado.dnp.dappnode.eth",
    title: "Electrum Server",
    description:
      "Connect your hardware wallet to your own Bitcoin node. The Electrum Server (Fulcrum) answers your wallet's questions from your own node.",
    links: { OnboardingWizard: "http://fulcrum.my.ava.do", HomePage: "https://github.com/cculianu/Fulcrum" },
    ports: [port(50001), port(50002)],
    volumes: [volume("fulcrum.avado.dnp.dappnode.eth", "fulcrum", "132.8GB")],
    envs: { DB_MEM_MB: "2048" },
  }),
  pkg({
    name: "mempool.avado.dnp.dappnode.eth",
    title: "Bitcoin Explorer",
    description: "See the current Bitcoin fees, the transactions waiting for a block and your own addresses, all from your own node.",
    links: {
      OnboardingWizard: "http://mempool.my.ava.do/avado/",
      Explorer: "http://mempool.my.ava.do",
      HomePage: "https://github.com/mempool/mempool",
    },
    volumes: [volume("mempool.avado.dnp.dappnode.eth", "mempool", "4.1GB")],
  }),
  pkg({
    name: "starknet.avado.dnp.dappnode.eth",
    version: IPFS_HASH,
    origin: IPFS_HASH,
    title: "Starknet Validator",
    description: "Run your own Starknet node and earn STRK as a Starknet validator. The node (Juno) and the validator run on your AVADO.",
    links: {
      OnboardingWizard: "http://starknet.my.ava.do",
      "Starknet RPC endpoint": "http://starknet.my.ava.do:6060/v0_10",
      HomePage: "https://www.starknet.io/staking/",
    },
    volumes: [volume("starknet.avado.dnp.dappnode.eth", "starknet", "312.0GB")],
    envs: { JUNO_EXTRA_OPTS: "", VALIDATOR_EXTRA_OPTS: "" },
  }),
  pkg({
    name: "aztec.avado.dnp.dappnode.eth",
    title: "Aztec Sequencer",
    description: "Run your own Aztec node and, with 200,000 AZTEC staked from your own wallet, take part as a sequencer.",
    links: { OnboardingWizard: "http://aztec.my.ava.do", HomePage: "https://aztec.network" },
    ports: [port(40400), port(40400, "udp")],
    volumes: [volume("aztec.avado.dnp.dappnode.eth", "aztec", "88.2GB")],
    envs: { EXTRA_OPTS: "", LOG_LEVEL: "info" },
  }),
  pkg({
    name: "vaultwarden.avado.dnp.dappnode.eth",
    title: "Vaultwarden (passwords)",
    description: "Your own password manager, kept on your AVADO instead of in someone else's cloud. Works with the Bitwarden apps.",
    links: {
      "Open Vaultwarden": "https://vaultwarden.my.ava.do",
      "Bitwarden apps": "https://bitwarden.com/download/",
      "Vaultwarden project": "https://github.com/dani-garcia/vaultwarden",
    },
    volumes: [volume("vaultwarden.avado.dnp.dappnode.eth", "data", "12.3MB"), bind("/etc/localtime")],
  }),
  pkg({
    name: "paperless.avado.dnp.dappnode.eth",
    title: "Paperless-ngx (documents)",
    description: "Your own paperless office. Scan or photograph letters, bills and contracts and find any of them again in seconds.",
    links: {
      "Open Paperless": "https://paperless.my.ava.do",
      "Document language": "http://my.ava.do/#/packages/paperless.avado.dnp.dappnode.eth?tab=settings",
      "Paperless-ngx project": "https://docs.paperless-ngx.com",
    },
    volumes: [
      volume("paperless.avado.dnp.dappnode.eth", "data", "220.5MB"),
      volume("paperless.avado.dnp.dappnode.eth", "media", "3.4GB"),
      volume("paperless.avado.dnp.dappnode.eth", "consume", "0B"),
      volume("paperless.avado.dnp.dappnode.eth", "export", "0B"),
      bind("/etc/localtime"),
      bind("/etc/timezone"),
    ],
    envs: { PAPERLESS_OCR_LANGUAGE: "eng" },
  }),
  pkg({
    name: "jellyfin.avado.dnp.dappnode.eth",
    title: "Jellyfin (films and music)",
    description: "Your own streaming service for the films, series, music and home videos you keep on your AVADO.",
    links: {
      "Open Jellyfin": "https://jellyfin.my.ava.do",
      "Add films and music": "https://jellyfin.my.ava.do/avado-upload/",
      "Jellyfin apps": "https://jellyfin.org/downloads/clients/",
      "Jellyfin project": "https://jellyfin.org",
    },
    volumes: [
      volume("jellyfin.avado.dnp.dappnode.eth", "config", "85.0MB"),
      volume("jellyfin.avado.dnp.dappnode.eth", "cache", "1.2GB"),
      volume("jellyfin.avado.dnp.dappnode.eth", "media", "412.7GB"),
      bind("/etc/localtime"),
    ],
  }),
  pkg({
    name: "homeassistant.avado.dnp.dappnode.eth",
    title: "Home Assistant (smart home)",
    description: "Home Assistant brings your smart home together in one private app: lights, heating, sensors and more.",
    links: {
      "Open Home Assistant": "https://homeassistant.my.ava.do",
      "Home Assistant apps": "https://companion.home-assistant.io/download",
      "Home Assistant project": "https://www.home-assistant.io",
    },
    volumes: [volume("homeassistant.avado.dnp.dappnode.eth", "config", "310.0MB"), bind("/etc/localtime")],
  }),
  pkg({
    name: "immich.avado.dnp.dappnode.eth",
    title: "Immich (photos)",
    description: "Your own photo cloud: Immich backs up the photos and videos from your phone to your AVADO.",
    links: {
      "Open Immich": "https://immich.my.ava.do",
      "Immich apps": "https://immich.app/download",
      "Immich project": "https://immich.app",
    },
    volumes: [
      volume("immich.avado.dnp.dappnode.eth", "library", "96.4GB"),
      volume("immich.avado.dnp.dappnode.eth", "database", "1.1GB"),
      volume("immich.avado.dnp.dappnode.eth", "models", "780.0MB"),
      bind("/etc/localtime"),
    ],
  }),
  pkg({
    name: "assistant.avado.dnp.dappnode.eth",
    title: "Private Assistant",
    description: "Your own AI chat assistant, running entirely on your AVADO. Ask questions without sending them to anyone else.",
    links: {
      OnboardingWizard: "http://assistant.my.ava.do/avado/",
      "Open the assistant": "http://assistant.my.ava.do",
      HomePage: "https://ava.do",
    },
    volumes: [
      volume("assistant.avado.dnp.dappnode.eth", "assistant_models", "8.7GB"),
      volume("assistant.avado.dnp.dappnode.eth", "assistant_data", "45.0MB"),
    ],
  }),
  pkg({
    name: "mcp.avado.dnp.dappnode.eth",
    version: "0.2.0",
    title: "AI Connect",
    description: "Connect your own AI assistant to your AVADO, so it can check on your node for you.",
    links: { OnboardingWizard: "http://mcp.my.ava.do", HomePage: "https://ava.do" },
    volumes: [volume("mcp.avado.dnp.dappnode.eth", "mcp", "2.0MB")],
  }),
  pkg({
    name: "tailscale.avado.dnp.dappnode.eth",
    title: "Tailscale",
    description: "Reach your whole AVADO from your phone or laptop wherever you are, without opening ports on your router.",
    links: { OnboardingWizard: "http://tailscale.my.ava.do", HomePage: "https://tailscale.com" },
    volumes: [volume("tailscale.avado.dnp.dappnode.eth", "tailscale", "1.0MB"), bind("/dev/net/tun")],
    envs: { TS_AUTHKEY: "", TS_ROUTES: "172.33.0.0/16", TS_EXTRA_ARGS: "--advertise-exit-node", TS_DEBUG_FIREWALL_MODE: "auto" },
  }),
  // Teku and Nimbus with the Client UI that carries the Lido CSM page.
  pkg({
    name: "teku.avado.dnp.dappnode.eth",
    version: "0.0.78",
    title: "Teku",
    description: "Teku is a Java implementation of the Ethereum 2.0 Beacon Chain.",
    links: { OnboardingWizard: "http://teku.my.ava.do", HomePage: "https://docs.teku.consensys.net/en/24.2.0/" },
    ports: [port(9000, "udp"), port(9000), port(9001, "udp")],
    volumes: [volume("teku.avado.dnp.dappnode.eth", "data", "214.6GB")],
    envs: { EXTRA_OPTS: "", JAVA_OPTS: "-Xmx8g", MODE: "syncing" },
  }),
  pkg({
    name: "nimbus.avado.dnp.dappnode.eth",
    version: "0.0.52",
    title: "Nimbus",
    description: "Nimbus-eth2 is an extremely efficient consensus layer (eth2) client implementation.",
    links: { OnboardingWizard: "http://nimbus.my.ava.do", HomePage: "https://nimbus.guide/" },
    ports: [port(9100), port(9100, "udp"), port(9103, "udp")],
    volumes: [volume("nimbus.avado.dnp.dappnode.eth", "data", "198.2GB")],
    envs: { EXTRA_OPTS: "" },
    state: "exited",
  }),
];
