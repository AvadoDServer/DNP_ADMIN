import { runSaga, stdChannel } from "redux-saga";
import { call, delay, put } from "redux-saga/effects";
import APIcall from "API/rpcMethods";
import chainDataSaga, { requestChainData, whenTabVisible, CHAIN_DATA_RENEW_MS, CHAIN_DATA_RETRY_MS } from "services/chainData/sagas";
import { REQUEST_CHAIN_DATA } from "services/chainData/actionTypes";
import { CONNECTION_OPEN } from "services/connectionStatus/actionTypes";

vi.mock("API/rpcMethods", () => ({ default: { requestChainData: vi.fn() } }));

let hidden = false;
const setHidden = value => {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
};
beforeEach(() => {
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
afterEach(() => {
  delete document.hidden;
});

// Runs a saga against a bare channel: whatever it puts is fed back in, like
// the real store does, so its own REQUEST_CHAIN_DATA restarts the loop.
function start(saga) {
  const channel = stdChannel();
  const dispatched = [];
  const task = runSaga(
    {
      channel,
      dispatch: action => {
        dispatched.push(action);
        channel.put(action);
      },
      getState: () => ({}),
    },
    saga
  );
  return { task, dispatched, put: action => channel.put(action) };
}

describe("requestChainData", () => {
  it("requests chain data, waits 5 minutes and puts the action object (not the creator) to go again", () => {
    const gen = requestChainData();
    expect(gen.next().value).toEqual(call(APIcall.requestChainData));
    expect(gen.next().value).toEqual(delay(CHAIN_DATA_RENEW_MS));
    expect(gen.next().value).toEqual(call(whenTabVisible));
    const next = gen.next().value;
    expect(next).toEqual(put({ type: REQUEST_CHAIN_DATA }));
    // A bare function here is swallowed by redux-thunk and the loop dies.
    expect(typeof next.payload.action).toBe("object");
    expect(gen.next().done).toBe(true);
  });

  it("retries after a minute when the request fails", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const gen = requestChainData();
    gen.next();
    expect(gen.throw(Error("Connection is not open")).value).toEqual(delay(CHAIN_DATA_RETRY_MS));
    expect(gen.next().value).toEqual(call(whenTabVisible));
    expect(gen.next().value).toEqual(put({ type: REQUEST_CHAIN_DATA }));
    expect(gen.next().done).toBe(true);
    spy.mockRestore();
  });
});

describe("chainData saga", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    APIcall.requestChainData.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps chain data live past 5 minutes, with one loop even after a reconnect", async () => {
    const { task, put: dispatch } = start(chainDataSaga);
    dispatch({ type: CONNECTION_OPEN });
    dispatch({ type: CONNECTION_OPEN }); // reconnect: must replace the first loop, not add one
    await vi.advanceTimersByTimeAsync(0);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RENEW_MS);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(3);
    // Still live after 6 minutes and beyond: one request per 5 minutes.
    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RENEW_MS);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(4);
    task.cancel();
  });

  it("a hidden tab does not renew, and asks again as soon as it is shown", async () => {
    const { task, put: dispatch } = start(chainDataSaga);
    dispatch({ type: CONNECTION_OPEN });
    await vi.advanceTimersByTimeAsync(0);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(1);

    hidden = true;
    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RENEW_MS * 3);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(1);

    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(2);
    // Back to one request per 5 minutes.
    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RENEW_MS);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(3);
    task.cancel();
  });

  it("a hidden tab stops retrying a failed request too", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    APIcall.requestChainData.mockRejectedValue(Error("Connection is not open"));
    hidden = true;
    const { task, put: dispatch } = start(chainDataSaga);
    dispatch({ type: CONNECTION_OPEN });
    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RETRY_MS * 10);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    task.cancel();
    spy.mockRestore();
  });

  it("a reconnect while hidden still leaves one loop", async () => {
    hidden = true;
    const { task, put: dispatch } = start(chainDataSaga);
    dispatch({ type: CONNECTION_OPEN });
    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RENEW_MS);
    // Waiting for the tab; a reconnect replaces that loop with its own request.
    dispatch({ type: CONNECTION_OPEN });
    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RENEW_MS);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(2);

    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(3);
    task.cancel();
  });

  it("recovers from a failed request", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    APIcall.requestChainData.mockRejectedValueOnce(Error("Connection is not open"));
    const { task, put: dispatch } = start(chainDataSaga);
    dispatch({ type: CONNECTION_OPEN });
    await vi.advanceTimersByTimeAsync(0);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(CHAIN_DATA_RETRY_MS);
    expect(APIcall.requestChainData).toHaveBeenCalledTimes(2);
    task.cancel();
    spy.mockRestore();
  });
});
