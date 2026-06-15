import autobahn from "autobahn-browser";
import store from "../store";
import subscriptions from "./subscriptions";
import {
  connectionOpen,
  connectionClose
} from "services/connectionStatus/actions";

// Initalize app
// Development
// const url = 'ws://localhost:8080/ws';
// const realm = 'realm1';
// Produccion
const url = "ws://wamp.my.ava.do:8080/ws";
const realm = "dappnode_admin";

// URL of the DAPPMANAGER :80 static endpoint that serves the per-box JWT
// (jwttoken.txt). Used as the WAMP `ticket` shared secret (see
// DNP_WAMP/docs/wamp-auth-hardening-design.md §4.3). Configurable via
// REACT_APP_JWT_URL; defaults to the dappmanager host under the box's
// `*.my.ava.do` internal domain.
//
// CORS consideration (spec §4.3 / §8): the Admin UI origin differs from the
// DAPPMANAGER :80 static origin, so this cross-origin fetch needs a CORS
// allowance on that static server (or same-origin delivery of the JWT).
const jwtUrl =
  import.meta.env.REACT_APP_JWT_URL || "http://dappmanager.my.ava.do/jwttoken.txt";

let sessionCache;

export const getSession = () => sessionCache;

// Fetch the box JWT used as the WAMP ticket. Failures are non-fatal: the WAMP
// server accepts BOTH anonymous and ticket auth during the staged rollout
// (Phase 0), so we log and fall back to an empty ticket and still attempt to
// connect rather than blocking the Admin UI.
async function fetchBoxJwt() {
  try {
    const res = await fetch(jwtUrl);
    if (!res.ok) {
      console.warn(`Could not fetch box JWT (${res.status} ${res.statusText})`);
      return "";
    }
    return (await res.text()).trim();
  } catch (e) {
    console.warn(`Could not fetch box JWT from ${jwtUrl}: ${e.message}`);
    return "";
  }
}

export default async function start() {
  const jwt = await fetchBoxJwt();

  const connection = new autobahn.Connection({
    url,
    realm,
    authmethods: ["ticket"],
    authid: "admin",
    // eslint-disable-next-line no-unused-vars
    onchallenge: (session, method, extra) => {
      if (method === "ticket") return jwt;
      throw Error("unsupported authmethod " + method);
    }
  });

  connection.onopen = session => {
    sessionCache = session;
    store.dispatch(connectionOpen({ session }));
    console.log("CONNECTED to \nurl: " + url + " \nrealm: " + realm);
    // Start subscriptions
    subscriptions(session);
    // For testing:
    window.call = (event, kwargs = {}) => session.call(event, [], kwargs);
  };

  // connection closed, lost or unable to connect
  connection.onclose = (reason, details) => {
    store.dispatch(
      connectionClose({
        error: [reason, (details || {}).message].filter(x => x).join(" - "),
        session: connection,
        isNotAdmin: (details.message || "").includes(
          "could not authenticate session"
        )
      })
    );
    console.error("CONNECTION_CLOSE", { reason, details });
  };

  connection.open();
}
