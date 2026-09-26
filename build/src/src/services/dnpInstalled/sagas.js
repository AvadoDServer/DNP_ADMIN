import { put, call, all, delay, race, take, takeLatest } from "redux-saga/effects";
import { eventChannel } from "redux-saga";
import api from "API/rpcMethods";
import * as a from "./actions";
import * as t from "./actionTypes";
import { wrapErrorsAndLoading } from "services/loadingStatus/sagas";
import * as loadingIds from "services/loadingStatus/loadingIds";
import { CONNECTION_OPEN } from "services/connectionStatus/actionTypes";
// Utils

import { rootWatcher } from "utils/redux";

// Service > dnpInstalled

// It's okay, because all non-handled sagas are wrapped on a try/catch
// /* eslint-disable redux-saga/no-unhandled-errors */

const fetchDnpInstalled = wrapErrorsAndLoading(
  loadingIds.dnpInstalled,
  function*() {
    const dnps = yield call(
      api.listPackages,
      {},
      { toastOnError: true, throw: true }
    );
    yield put(a.updateDnpInstalled(dnps));
  }
);

/*
 * Silent background refresh of the installed packages.
 *
 * The core only pushes the package list over WAMP after something the Admin
 * asked for (install, stop, auto-update switch...). A client that crashes or
 * is stopped any other way would keep showing "Running" until the page is
 * reloaded. So the list is also refreshed quietly: no loading state (the My
 * DApps list must not flip to "Loading…"), no toast, failures ignored (the
 * next poll tries again).
 *
 * Each listPackages runs `docker system df --verbose` on the box, which sizes
 * every volume. That took about 0.15 s on a test box with an 89 GB Nimbus
 * database, but it walks every file of a large execution-client database,
 * and the box runs validators. So: every few minutes, only while this tab is
 * visible, never two at once, plus once when the tab comes back into view.
 */
export const SILENT_REFRESH_MS = 3 * 60 * 1000;
// A refresh with no answer by then is given up (AVADO Care allows
// listPackages the same 90 s); the next poll starts a new one.
export const SILENT_REFRESH_TIMEOUT_MS = 90 * 1000;
// Coming back to the tab refreshes at once, unless the last refresh was this
// recent (switching back and forth between tabs must not hammer the box).
export const VISIBLE_REFRESH_MIN_GAP_MS = 60 * 1000;

const tabVisible = () => typeof document === "undefined" || !document.hidden;

/** Emits each time this tab becomes visible again. */
export function visibilityChannel() {
  return eventChannel(emit => {
    if (typeof document === "undefined") return () => {};
    const onChange = () => {
      if (tabVisible()) emit("visible");
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  });
}

export function* silentRefresh() {
  try {
    const { dnps } = yield race({
      dnps: call(api.listPackages),
      timeout: delay(SILENT_REFRESH_TIMEOUT_MS),
      // A WAMP push (or a regular fetch) landed meanwhile: the list is
      // already fresh, and this answer may predate it, so drop it.
      newer: take(t.UPDATE_DNP_INSTALLED),
    });
    if (dnps) yield put(a.updateDnpInstalled(dnps));
  } catch (e) {
    console.warn(`Background refresh of installed packages failed: ${e.message}`);
  }
}

export function* silentPoll() {
  const shown = yield call(visibilityChannel);
  // Started on CONNECTION_OPEN, which has just fetched the list.
  let lastRefresh = Date.now();
  try {
    while (true) {
      const { tick } = yield race({ tick: delay(SILENT_REFRESH_MS), shown: take(shown) });
      if (!tabVisible()) continue;
      if (!tick && Date.now() - lastRefresh < VISIBLE_REFRESH_MIN_GAP_MS) continue;
      lastRefresh = Date.now();
      // Blocking, so a second refresh never starts while one is in flight
      // (the channel drops visibility events meanwhile).
      yield call(silentRefresh);
    }
  } finally {
    shown.close();
  }
}

/******************************* Watchers *************************************/

// Each saga is mapped with its actionType using takeEvery
// takeEvery(actionType, watchers[actionType])
const watchers = rootWatcher([
  [CONNECTION_OPEN, fetchDnpInstalled],
  [t.FETCH_DNP_INSTALLED, fetchDnpInstalled]
]);

export default function* dnpInstalledSaga() {
  yield all([
    call(watchers),
    // Latest-only: a reconnect cancels the previous poll loop instead of
    // starting a second one next to it.
    takeLatest(CONNECTION_OPEN, silentPoll)
  ]);
}
