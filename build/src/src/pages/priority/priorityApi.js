import axios from "axios";
import api from "API/rpcMethods";

/**
 * Client for the AVADO Priority Support backend (avado-priority-support-backend).
 *
 *   GET  /subscription/status/:nodeId -> { hasSubscription, subscription, serverTime }
 *   POST /subscription/checkout       -> { url }  Stripe Checkout
 *   POST /subscription/portal         -> { url }  Stripe Customer Portal
 *
 * Status is open. Checkout and portal requests are signed by the box: the
 * DAPPMANAGER signs { action, plan, timestamp } with the identity key behind the
 * node id (signPrioritySupportRequest), so nobody who merely knows a node id can
 * open another box's billing. The timestamp is the backend's own serverTime, so
 * a box with a wrong clock can still subscribe.
 *
 * Deployment config (statically injected by Vite from REACT_APP_* env at build time):
 *   REACT_APP_PRIORITY_API_URL  base URL of the backend  (default https://priority.ava.do/api)
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) every call is served locally so the page
 * is fully usable without a backend or a box.
 */

const MOCK = Boolean(import.meta.env.REACT_APP_MOCK_DATA);
const BASE_URL =
  import.meta.env.REACT_APP_PRIORITY_API_URL || "https://priority.ava.do/api";

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

export const NODE_ID_REGEX = /^0x[0-9a-fA-F]{40}$/;

/** Extract a human-readable message from an axios error (backend sends { error } / { message }). */
function toError(error, fallback) {
  const data = error && error.response && error.response.data;
  const message = (data && (data.error || data.message)) || (error && error.message);
  const result = new Error(message || fallback);
  if (data && data.code) result.code = data.code;
  return result;
}

/* ---------------- mock backend (dev only) ---------------- */
let mockSubscription = null;
const delay = (value, ms = 600) =>
  new Promise(resolve => setTimeout(() => resolve(value), ms));

function mockSubscribe(plan) {
  const start = new Date();
  const end = new Date();
  if (plan === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  mockSubscription = {
    planType: plan,
    status: "active",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    cancelAtPeriodEnd: false
  };
}

/**
 * Fetch the current subscription status for this box.
 * @param {string} nodeId box identity (DAppNode node id)
 * @returns {Promise<{hasSubscription: boolean, subscription: object|null, serverTime: number}>}
 */
export async function getStatus(nodeId) {
  if (MOCK)
    return delay({
      hasSubscription: Boolean(mockSubscription),
      subscription: mockSubscription,
      serverTime: Math.floor(Date.now() / 1000)
    });
  try {
    const { data } = await client.get(
      `/subscription/status/${encodeURIComponent(nodeId)}`
    );
    return data;
  } catch (error) {
    throw toError(error, "Could not load subscription status");
  }
}

/**
 * Ask the DAPPMANAGER to sign a billing request for this box.
 * A DAPPMANAGER older than the Stripe release does not have the call.
 */
async function signRequest(nodeId, action, plan) {
  // Doubles as "is the billing service reachable" before we bother the box
  const { serverTime } = await getStatus(nodeId);
  try {
    const kwargs = { action, timestamp: serverTime };
    if (plan) kwargs.plan = plan;
    return await api.signPrioritySupportRequest(kwargs);
  } catch (e) {
    if (/no_such_procedure|no callee registered/i.test(e.message || ""))
      throw new Error(
        "Your AVADO needs a system update before it can manage subscriptions. Go to System and install the available update, then try again."
      );
    throw e;
  }
}

/**
 * Start a Stripe Checkout for this box. Resolves with the URL to send the browser to.
 * @param {string} nodeId box identity (DAppNode node id)
 * @param {string} plan "monthly" | "yearly"
 * @returns {Promise<string>} Stripe Checkout URL
 */
export async function createCheckout(nodeId, plan) {
  if (MOCK) {
    mockSubscribe(plan);
    return delay(`${window.location.pathname}#/priority?checkout=success`);
  }
  const signed = await signRequest(nodeId, "checkout", plan);
  try {
    const { data } = await client.post(`/subscription/checkout`, {
      nodeId: signed.nodeid,
      plan,
      timestamp: signed.timestamp,
      signature: signed.signature,
      returnOrigin: window.location.origin
    });
    return data.url;
  } catch (error) {
    throw toError(error, "Could not start the checkout");
  }
}

/**
 * Open the Stripe Customer Portal of this box (payment method, invoices, cancel).
 * @param {string} nodeId box identity (DAppNode node id)
 * @returns {Promise<string>} Stripe Customer Portal URL
 */
export async function createPortal(nodeId) {
  if (MOCK) {
    if (mockSubscription) mockSubscription.cancelAtPeriodEnd = !mockSubscription.cancelAtPeriodEnd;
    return delay(`${window.location.pathname}#/priority`);
  }
  const signed = await signRequest(nodeId, "portal");
  try {
    const { data } = await client.post(`/subscription/portal`, {
      nodeId: signed.nodeid,
      timestamp: signed.timestamp,
      signature: signed.signature,
      returnOrigin: window.location.origin
    });
    return data.url;
  } catch (error) {
    throw toError(error, "Could not open billing");
  }
}
