import { pushSupported, deviceName } from "./device";

/**
 * Push alerts for this browser or phone (DAPPMANAGER 10.0.59 and newer
 * sends them, see its modules/push). Turning them on asks the browser for
 * permission, subscribes with the box's public key and gives the
 * subscription to the box. The box then sends straight to the browser's own
 * push service (free; no AVADO server).
 *
 * In mock mode (`yarn dev`) the box side is simulated.
 */

export const TEXTS = {
  denied: "Alerts are blocked for this address in the browser's settings. Allow notifications for admin.my.ava.do there, then try again.",
  notAllowed: "Alerts were not allowed. Press the switch again and choose Allow.",
  lost: "The connection to your AVADO was lost. Reload the page and try again.",
  failed: "Could not turn alerts on. Try again; if it keeps failing, contact AVADO support.",
  oldCore: "Your AVADO needs an update before it can send alerts."
};

const rpc = () => import("API/rpcMethods").then(m => m.default);
const mock = () => Boolean(import.meta.env.REACT_APP_MOCK_DATA);
const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
let mockEndpoints = new Set();

const NO_SUCH_CALL = /no_such_procedure|no such procedure|not registered/i;
const TRANSPORT_ERROR =
  /callee disconnected|wamp\.error\.(canceled|cancelled|timeout)|connection (is )?(not open|lost|closed)|session (object )?is not defined|timed? ?out/i;

/** An error as the sentence the card shows */
export function errorText(e) {
  const msg = String((e && e.message) || e || "");
  if (NO_SUCH_CALL.test(msg)) return TEXTS.oldCore;
  if (TRANSPORT_ERROR.test(msg)) return TEXTS.lost;
  if (/^[A-Z][^\n]{0,200}\.$/.test(msg)) return msg;
  return TEXTS.failed;
}

/** base64url -> Uint8Array (the applicationServerKey) */
export function keyToBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const box = {
  getKey: () =>
    mock()
      ? delay("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", 200)
      : rpc().then(api => api.pushGetKey({}).then(r => r.publicKey)),
  subscribe: (subscription, name) =>
    mock()
      ? delay(null, 400).then(() => mockEndpoints.add(subscription.endpoint))
      : rpc().then(api => api.pushSubscribe({ subscription, name })),
  unsubscribe: endpoint => (mock() ? delay(null, 300).then(() => mockEndpoints.delete(endpoint)) : rpc().then(api => api.pushUnsubscribe({ endpoint }))),
  status: endpoint =>
    mock() ? delay({ subscribed: mockEndpoints.has(endpoint), devices: mockEndpoints.size }, 200) : rpc().then(api => api.pushStatus({ endpoint })),
  test: endpoint => (mock() ? delay(null, 800) : rpc().then(api => api.pushTest({ endpoint })))
};

async function registration() {
  return navigator.serviceWorker.ready;
}

/** This browser's subscription, or null */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

/**
 * Whether alerts are on for this browser: it has a subscription AND the box
 * knows it. { on, permission }
 */
export async function readState(boxImpl = box) {
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  const sub = await currentSubscription();
  if (!sub) return { on: false, permission };
  const status = await boxImpl.status(sub.endpoint);
  return { on: Boolean(status && status.subscribed), permission };
}

/** Turns alerts on. Resolves when on; rejects with a sentence. */
export async function turnOn(boxImpl = box) {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "denied") throw Error(TEXTS.denied);
    if (permission !== "granted") throw Error(TEXTS.notAllowed);
    const publicKey = await boxImpl.getKey();
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    // A subscription made with another key (a reset box) cannot be used
    if (sub && sub.options && sub.options.applicationServerKey) {
      const had = new Uint8Array(sub.options.applicationServerKey);
      const want = keyToBytes(publicKey);
      if (had.length !== want.length || had.some((b, i) => b !== want[i])) {
        await sub.unsubscribe();
        sub = null;
      }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
    await boxImpl.subscribe(sub.toJSON(), deviceName());
  } catch (e) {
    throw Error(Object.values(TEXTS).includes(e && e.message) ? e.message : errorText(e));
  }
}

/** Turns alerts off for this browser (on the box and in the browser) */
export async function turnOff(boxImpl = box) {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await boxImpl.unsubscribe(sub.endpoint);
    await sub.unsubscribe();
  } catch (e) {
    throw Error(errorText(e));
  }
}

/** Asks the box to send a test alert to this browser */
export async function sendTest(boxImpl = box) {
  try {
    const sub = await currentSubscription();
    if (!sub) throw Error("Alerts are not on for this device. Turn them on first.");
    await boxImpl.test(sub.endpoint);
  } catch (e) {
    throw Error(errorText(e));
  }
}

// Tests only
export function _resetMock() {
  mockEndpoints = new Set();
}
