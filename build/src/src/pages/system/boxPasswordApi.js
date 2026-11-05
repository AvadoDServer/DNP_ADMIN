import { useEffect, useState } from "react";

/**
 * The box's login password: the password of the `avado` user, used to log in
 * to the AVADO with SSH. Every AVADO ships with the password `avado`.
 * DAPPMANAGER 10.0.57 and newer (callers check canChangeBoxPassword first):
 *
 *   passwordIsSecure() -> true (changed) | false (still avado) | null (unknown)
 *   passwordChange({ currentPassword, newPassword }) -> null
 *     The DAPPMANAGER checks the current password on the box before it changes
 *     anything, and answers with a plain sentence when it refuses
 *     ("The current password is wrong.").
 *
 * The passwords are never logged here, never put in the redux store (whose
 * actions the dev tools record) and never in a toast; the form forgets them
 * once the change is done.
 *
 * In mock mode (`yarn dev`) the box starts with the password `avado`.
 */

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 128;
export const FACTORY_PASSWORD = "avado";
export const PAGE_PATH = "/system/password";
export const SUCCESS_TEXT = "Done. Use the new password next time you log in to your AVADO with SSH.";
export const NOT_SAME_TEXT = "The two new passwords are not the same.";
export const LOST_TEXT = "The connection to your AVADO was lost. Reload the page and try again.";
export const OLD_CORE_TEXT = "Your AVADO needs an update before its password can be changed here.";
export const FAILED_TEXT = "Could not change the password. Try again; if it keeps failing, contact AVADO support.";

// Loaded on first use: API/rpcMethods brings the WAMP session and the whole
// redux store with it, which HealthProvider (and its tests) must not import.
const rpc = () => import("API/rpcMethods").then(m => m.default);

const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
let mockPassword = FACTORY_PASSWORD;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * The same rules the DAPPMANAGER applies, checked here first so the owner
 * gets the answer at once. The first rule broken, as a sentence; null if none.
 */
export function newPasswordProblem(newPassword, currentPassword) {
  if (!newPassword) return "Type a new password.";
  if (newPassword.trim().toLowerCase() === FACTORY_PASSWORD) return "Choose a password other than avado.";
  if (CONTROL.test(newPassword)) return "The new password cannot contain line breaks or other control characters.";
  if ([...newPassword].length < MIN_LENGTH) return `The new password must have at least ${MIN_LENGTH} characters.`;
  if ([...newPassword].length > MAX_LENGTH) return `The new password can have at most ${MAX_LENGTH} characters.`;
  if (currentPassword && newPassword === currentPassword) return "The new password must be different from the current one.";
  return null;
}

const NO_SUCH_CALL = /no_such_procedure|no such procedure|not registered/i;
const TRANSPORT_ERROR =
  /callee disconnected|wamp\.error\.(canceled|cancelled|timeout)|connection (is )?(not open|lost|closed)|session (object )?is not defined|timed? ?out/i;

/** An error of passwordChange as the sentence the form shows */
export function errorText(e) {
  const msg = String((e && e.message) || e || "");
  if (NO_SUCH_CALL.test(msg)) return OLD_CORE_TEXT;
  if (TRANSPORT_ERROR.test(msg)) return LOST_TEXT;
  // The DAPPMANAGER's own sentences end with a full stop; anything else is a
  // technical message the owner cannot act on
  if (/^[A-Z][^\n]{0,200}\.$/.test(msg)) return msg;
  return FAILED_TEXT;
}

/* ---------------- whether the factory password is in use ---------------- */

// null = not known yet; shared so a change on one page hides Home's notice
let isDefault = null;
const listeners = new Set();
const setIsDefault = value => {
  isDefault = value;
  for (const l of [...listeners]) l(isDefault);
};

export function passwordIsSecure() {
  if (import.meta.env.REACT_APP_MOCK_DATA) return delay(mockPassword !== FACTORY_PASSWORD, 300);
  return rpc().then(api => api.passwordIsSecure({}));
}

/** Asks the DAPPMANAGER once; a failed check leaves it unknown (null). */
export function loadIsDefault(checkImpl = passwordIsSecure) {
  return Promise.resolve()
    .then(() => checkImpl())
    .then(
      secure => {
        setIsDefault(secure === true ? false : secure === false ? true : null);
        return isDefault;
      },
      e => {
        console.debug(`passwordIsSecure failed: ${e && e.message}`);
        return isDefault;
      }
    );
}

/**
 * React: true while the box still has the factory password, false once it was
 * changed, null while unknown. Asks on mount when `allowed`.
 */
export function useIsDefaultPassword(allowed, checkImpl) {
  const [value, setValue] = useState(isDefault);
  useEffect(() => {
    setValue(isDefault);
    listeners.add(setValue);
    if (allowed) loadIsDefault(checkImpl);
    return () => listeners.delete(setValue);
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  return allowed ? value : null;
}

/* ---------------- the change ---------------- */

function callChange({ currentPassword, newPassword }) {
  if (import.meta.env.REACT_APP_MOCK_DATA)
    return delay(null, 1200).then(() => {
      if (currentPassword !== mockPassword) throw Error("The current password is wrong.");
      mockPassword = newPassword;
      return null;
    });
  return rpc().then(api => api.passwordChange({ currentPassword, newPassword }));
}

/**
 * Changes the password. Resolves on success; rejects with an Error whose
 * message is the sentence to show.
 */
export async function changeBoxPassword({ currentPassword, newPassword }, changeImpl = callChange) {
  try {
    await changeImpl({ currentPassword, newPassword });
  } catch (e) {
    throw Error(errorText(e));
  }
  setIsDefault(false);
}

/* ---------------- Home's notice ---------------- */

const DISMISS_KEY = "avado.boxPasswordNotice.dismissed";

export function isNoticeDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function dismissNotice() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch (e) {
    // A browser without storage shows the notice again next time
  }
}

// Tests only
export function _resetBoxPasswordState() {
  isDefault = null;
  listeners.clear();
  mockPassword = FACTORY_PASSWORD;
}
