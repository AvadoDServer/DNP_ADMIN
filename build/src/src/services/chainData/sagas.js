import { put, call, delay, takeLatest } from "redux-saga/effects";
import APIcall from "API/rpcMethods";
import * as a from "./actions";
import * as t from "./actionTypes";
import { CONNECTION_OPEN } from "services/connectionStatus/actionTypes";

// Service > chainData

// The DAPPMANAGER keeps pushing chain data for 5 minutes after each request
// (calls/requestChainData.js), so ask again once that window is over.
export const CHAIN_DATA_RENEW_MS = 5 * 60 * 1000;
// A failed request (e.g. the connection dropped) is tried again sooner.
export const CHAIN_DATA_RETRY_MS = 60 * 1000;

/**
 * Instruct the DAPPMANAGER to emit chain data during 5 minutes, then request
 * again. A failed request is retried after a minute.
 */
export function* requestChainData() {
  try {
    yield call(APIcall.requestChainData);
    yield delay(CHAIN_DATA_RENEW_MS);
  } catch (e) {
    console.error(`Error on requestChainData: ${e.stack}`);
    yield delay(CHAIN_DATA_RETRY_MS);
  }
  // The action object, not the action creator: redux-thunk swallows a bare
  // function as a thunk, which silently ended this loop after 5 minutes.
  yield put(a.requestChainData());
}

/******************************* Watchers *************************************/

// Latest-only across both actions: a reconnect (CONNECTION_OPEN) cancels the
// loop that is waiting to request again, so reconnects never stack loops.
export default function* chainDataSaga() {
  yield takeLatest([CONNECTION_OPEN, t.REQUEST_CHAIN_DATA], requestChainData);
}
