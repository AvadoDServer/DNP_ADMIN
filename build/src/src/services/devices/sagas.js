import { put, call } from "redux-saga/effects";
import { rootWatcher } from "utils/redux";
import api from "API/rpcMethods";
import * as a from "./actions";
import * as t from "./actionTypes";
import { loadingId } from "./data";
import {
  updateIsLoading,
  updateIsLoaded,
  updateLoading
} from "services/loadingStatus/actions";
import { CONNECTION_OPEN } from "services/connectionStatus/actionTypes";

// Service > devices

export function* fetchDevices() {
  try {
    yield put(updateIsLoading(loadingId));
    const devices = yield call(api.listDevices, {}, { toastOnError: false });
    yield put(a.updateDevices(devices));
    yield put(updateIsLoaded(loadingId));
  } catch (e) {
    // Without the VPN package there is no listDevices procedure: record the
    // error so the page stops showing "Loading devices..." forever
    yield put(updateLoading(loadingId, false, e.message));
  }
}

/******************************* Watchers *************************************/

// Each saga is mapped with its actionType using takeEvery
// takeEvery(actionType, watchers[actionType])
export default rootWatcher([
  [CONNECTION_OPEN, fetchDevices],
  [t.FETCH_DEVICES, fetchDevices]
]);
