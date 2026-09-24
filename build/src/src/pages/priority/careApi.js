import axios from "axios";
import api from "API/rpcMethods";
import {
  client,
  getStatus,
  MOCK,
  delay,
  getMockSubscription,
  isOldDappmanagerError,
  needsUpdateError
} from "./priorityApi";
import { sha256Hex } from "./sha256";

/**
 * Priority Care calls.
 *
 * Settings (alerts email, categories) go to the Priority Care backend:
 *
 *   POST /care/settings  body { nodeId, timestamp, signature, payload }
 *
 * `payload` is the exact JSON string whose sha256 the DAPPMANAGER signed
 * (signPrioritySupportRequest, action "care-settings", kwarg payloadHash), so
 * only this box can read or change its alert settings.
 *
 * "AVADO is watching your box" comes from the Care package on the box
 * (care.avado.dnp.dappnode.eth), read through the Admin's own same-origin
 * nginx proxy (/care-api/status -> http://care.my.ava.do/api/status, see
 * build/nginx.conf), with the package's hostname as a fallback.
 */

export const CARE_PACKAGE = "care.avado.dnp.dappnode.eth";
export const CARE_STATUS_URLS = ["/care-api/status", "http://care.my.ava.do/api/status"];
export const PREF_KEYS = ["offline", "critical", "updates", "monthly"];

const CARE_STATUS_TIMEOUT_MS = 8000;

/** Turn a backend / network failure into a message a box owner understands. */
export function toCareError(error) {
  if (error && error.code === "needs_update") return error;
  const response = error && error.response;
  const data = (response && response.data) || {};
  const serverMessage = typeof data.error === "string" ? data.error : "";
  let message;
  let code;
  if (!response) {
    message =
      "Could not reach the Priority Care service. Check this AVADO's internet connection and try again.";
    code = "unreachable";
  } else if (response.status === 401) {
    message =
      "The Priority Care service could not confirm this request came from your AVADO. Please try again.";
    code = "bad_signature";
  } else if (response.status === 402) {
    message = "Priority Care is not active on this AVADO.";
    code = "not_subscribed";
  } else if (response.status === 404) {
    message = "Priority Care settings are not available yet. Please try again later.";
    code = "not_available";
  } else if (response.status === 429) {
    message = "Too many attempts. Please wait a minute and try again.";
    code = "rate_limited";
  } else if (response.status >= 500) {
    message = "The Priority Care service has a problem right now. Please try again in a few minutes.";
    code = "server_error";
  } else {
    message = serverMessage || "Something went wrong. Please try again.";
    code = "rejected";
  }
  const result = new Error(message);
  result.code = code;
  return result;
}

/**
 * Sign a Priority Care request with this box's identity key.
 * @returns {Promise<{nodeId, timestamp, signature, payload}>} the request body
 */
export async function signCareRequest(nodeId, action, payloadObject) {
  const payload = JSON.stringify(payloadObject);
  const payloadHash = await sha256Hex(payload);
  let serverTime;
  try {
    ({ serverTime } = await getStatus(nodeId));
  } catch (e) {
    throw toCareError({});
  }
  let signed;
  try {
    signed = await api.signPrioritySupportRequest({
      action,
      timestamp: serverTime,
      payloadHash
    });
  } catch (e) {
    if (isOldDappmanagerError(e, action)) throw needsUpdateError();
    throw new Error(
      `Your AVADO could not sign the request (${e.message || "unknown error"}). Please try again.`
    );
  }
  // A DAPPMANAGER that ignores payloadHash signs a message the backend rejects
  if (!signed || (signed.payloadHash !== undefined && signed.payloadHash !== payloadHash))
    throw needsUpdateError();
  return {
    nodeId: signed.nodeid,
    timestamp: signed.timestamp,
    signature: signed.signature,
    payload
  };
}

/* ---------------- mock backend (dev only) ---------------- */
const mockSettings = {
  email: null,
  verified: false,
  prefs: { offline: true, critical: true, updates: true, monthly: true }
};

function mockSettingsResponse() {
  const sub = getMockSubscription();
  return {
    ...mockSettings,
    prefs: { ...mockSettings.prefs },
    lastHeartbeatAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    careInstalled: false,
    trialEligible: !sub,
    subscription: sub
      ? { status: sub.status, plan: sub.planType, currentPeriodEnd: sub.endDate }
      : null
  };
}

function mockSetSettings(payload) {
  if (payload.email !== undefined && payload.email !== mockSettings.email) {
    mockSettings.email = payload.email;
    mockSettings.verified = false;
    // Pretend the owner clicks the link a few seconds later
    setTimeout(() => {
      mockSettings.verified = true;
    }, 5000);
  }
  if (payload.prefs) mockSettings.prefs = { ...mockSettings.prefs, ...payload.prefs };
}

async function postSettings(nodeId, payload) {
  if (MOCK) {
    if (payload.op === "set") mockSetSettings(payload);
    return delay(mockSettingsResponse());
  }
  const body = await signCareRequest(nodeId, "care-settings", payload);
  try {
    const { data } = await client.post(`/care/settings`, body);
    return data;
  } catch (error) {
    throw toCareError(error);
  }
}

/**
 * Read this box's Priority Care settings.
 * @returns {Promise<{email, verified, prefs, lastHeartbeatAt, careInstalled, trialEligible, subscription}>}
 */
export function getCareSettings(nodeId) {
  return postSettings(nodeId, { v: 1, op: "get" });
}

/**
 * Change the alerts email and/or the alert categories. A new or changed email
 * gets a confirmation email from the backend.
 * @param {{email?: string, prefs?: object}} changes
 */
export function setCareSettings(nodeId, { email, prefs } = {}) {
  const payload = { v: 1, op: "set" };
  if (email !== undefined) payload.email = email;
  if (prefs !== undefined) {
    payload.prefs = {};
    for (const key of PREF_KEYS) payload.prefs[key] = Boolean(prefs[key]);
  }
  return postSettings(nodeId, payload);
}

/**
 * Status of the Care package on this box.
 * @returns {Promise<{version, lastHeartbeat: {at, ok, error}|null, verdict, findings, subscribed}>}
 * Rejects with code "care_unreachable" when the package does not answer.
 */
export async function getCareStatus({ urls = CARE_STATUS_URLS } = {}) {
  if (MOCK)
    return delay({
      version: "0.1.0",
      lastHeartbeat: { at: new Date(Date.now() - 3 * 60 * 1000).toISOString(), ok: true, error: null },
      verdict: "ok",
      findings: [],
      subscribed: Boolean(getMockSubscription())
    });
  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { timeout: CARE_STATUS_TIMEOUT_MS });
      // The Admin's SPA fallback answers unknown paths with index.html
      if (data && typeof data === "object") return data;
    } catch (e) {
      // try the next address
    }
  }
  const error = new Error("The AVADO Care app is not answering.");
  error.code = "care_unreachable";
  throw error;
}
