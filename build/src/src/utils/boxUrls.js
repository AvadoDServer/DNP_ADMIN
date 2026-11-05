/**
 * Where the Admin reaches the box's services, for both ways the Admin is
 * opened:
 *
 * - http://my.ava.do (the usual address): straight to each service, as
 *   always (ws://wamp.my.ava.do:8080, http://ipfs.my.ava.do:8080).
 * - https://admin.my.ava.do (the secure address, needed to add the Admin to
 *   a phone's home screen and for push alerts): a secure page may not open
 *   plain http or ws connections, so it goes through the Admin's own nginx on
 *   the same address (build/admin-locations.conf: /ws, /ipfs/,
 *   /ipfs-api/swarm/connect), which forwards inside the box.
 *
 * The secure address uses the *.my.ava.do certificate every AVADO already
 * gets (DAPPMANAGER watchers/certificates); it works wherever my.ava.do does
 * (AVADO Wi-Fi, VPN, Tailscale with the my.ava.do DNS).
 */

export const SECURE_HOST = "admin.my.ava.do";
export const SECURE_ADMIN_URL = `https://${SECURE_HOST}`;

const loc = () => (typeof window !== "undefined" && window.location) || { protocol: "http:", host: "my.ava.do", hostname: "my.ava.do", origin: "http://my.ava.do" };

export const isSecurePage = () => loc().protocol === "https:";

/** my.ava.do or one of its names (the box's own DNS answers for them) */
export const isBoxHostname = (hostname = loc().hostname) => hostname === "my.ava.do" || String(hostname).endsWith(".my.ava.do");

export const wampUrl = () => (isSecurePage() ? `wss://${loc().host}/ws` : "ws://wamp.my.ava.do:8080/ws");

export const ipfsGateway = () => (isSecurePage() ? `${loc().origin}/ipfs/` : "http://ipfs.my.ava.do:8080/ipfs/");

export const ipfsSwarmConnectUrl = () =>
  isSecurePage() ? `${loc().origin}/ipfs-api/swarm/connect?arg=` : "http://ipfs.my.ava.do:5001/api/v0/swarm/connect?arg=";

/** The same Admin page on the secure address (keeps the #/route) */
export const secureUrlForHere = () => `${SECURE_ADMIN_URL}/${(typeof window !== "undefined" && window.location.hash) || "#/dashboard"}`;

/**
 * A package page an https Admin cannot show inside itself: a browser blocks
 * a plain-http frame inside a secure page.
 */
export const isBlockedFrame = url => isSecurePage() && /^http:\/\//i.test(String(url || ""));
