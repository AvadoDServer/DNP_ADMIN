import axios from "axios";

/**
 * Client for the AVADO Priority Support backend (avado-priority-support-backend).
 *
 * Endpoints used (all require the box to authenticate via the X-API-Key header):
 *   GET  /subscription/status/:userId  -> { hasSubscription, subscription? }
 *   POST /subscription/activate        -> { success, subscription }   body: { userId, code }
 *
 * Deployment config (statically injected by Vite from REACT_APP_* env at build time):
 *   REACT_APP_PRIORITY_API_URL  base URL of the backend  (default https://priority.ava.do/api)
 *   REACT_APP_PRIORITY_API_KEY  the X-API-Key the box presents (optional; set per deployment)
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) every call is served locally so the page
 * is fully usable without a backend. The mock accepts the code "DEMO-CODE-123".
 */

const MOCK = Boolean(import.meta.env.REACT_APP_MOCK_DATA);
const BASE_URL =
  import.meta.env.REACT_APP_PRIORITY_API_URL || "https://priority.ava.do/api";
const API_KEY = import.meta.env.REACT_APP_PRIORITY_API_KEY || "";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: API_KEY ? { "X-API-Key": API_KEY } : {}
});

/** Extract a human-readable message from an axios error (backend sends { error } / { message }). */
function toError(error, fallback) {
  const data = error && error.response && error.response.data;
  const message = (data && (data.error || data.message)) || (error && error.message);
  return new Error(message || fallback);
}

/* ---------------- mock backend (dev only) ---------------- */
const MOCK_VALID_CODE = "DEMO-CODE-123";
let mockSubscription = null;
const delay = (value, ms = 600) =>
  new Promise(resolve => setTimeout(() => resolve(value), ms));

/**
 * Fetch the current subscription status for this box.
 * @param {string} userId stable box identifier (DAppNode node id)
 * @returns {Promise<{hasSubscription: boolean, subscription?: object}>}
 */
export async function getStatus(userId) {
  if (MOCK)
    return delay(
      mockSubscription
        ? { hasSubscription: true, subscription: mockSubscription }
        : { hasSubscription: false }
    );
  try {
    const { data } = await client.get(
      `/subscription/status/${encodeURIComponent(userId)}`
    );
    return data;
  } catch (error) {
    throw toError(error, "Could not load subscription status");
  }
}

/**
 * Activate a subscription with a purchased code. The backend validates the code,
 * creates the subscription and marks the code as used.
 * @param {string} userId stable box identifier
 * @param {string} code subscription code
 * @returns {Promise<{success: boolean, subscription: object}>}
 */
export async function activateSubscription(userId, code) {
  if (MOCK) {
    if (code !== MOCK_VALID_CODE) {
      await delay(null);
      throw new Error("Invalid subscription code. Please check and try again.");
    }
    const start = new Date();
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    mockSubscription = {
      planType: "annual",
      status: "active",
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
    return delay({ success: true, subscription: mockSubscription });
  }
  try {
    const { data } = await client.post(`/subscription/activate`, { userId, code });
    return data;
  } catch (error) {
    throw toError(error, "Could not activate subscription");
  }
}
