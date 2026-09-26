import { runSaga, stdChannel } from "redux-saga";
import api from "API/rpcMethods";
import dnpInstalledSaga, {
  silentRefresh,
  silentPoll,
  SILENT_REFRESH_MS,
  SILENT_REFRESH_TIMEOUT_MS,
  VISIBLE_REFRESH_MIN_GAP_MS,
} from "services/dnpInstalled/sagas";
import { updateDnpInstalled } from "services/dnpInstalled/actions";
import { UPDATE_DNP_INSTALLED } from "services/dnpInstalled/actionTypes";
import { CONNECTION_OPEN } from "services/connectionStatus/actionTypes";

vi.mock("API/rpcMethods", () => ({ default: { listPackages: vi.fn() } }));

const NIMBUS = { name: "nimbus.avado.dnp.dappnode.eth", state: "exited", running: false };

// Runs a saga against a bare channel: whatever it puts is recorded and fed
// back in, like the real store does.
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

const flush = () => vi.advanceTimersByTimeAsync(0);
// The silent refresh calls listPackages with no arguments (no toast options);
// the regular fetch passes `{}, { toastOnError: true, throw: true }`.
const silentCalls = () => api.listPackages.mock.calls.filter(args => args.length === 0).length;

let hidden = false;
const setHidden = value => {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers();
  api.listPackages.mockReset();
  api.listPackages.mockResolvedValue([NIMBUS]);
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
afterEach(() => {
  vi.useRealTimers();
  delete document.hidden;
});

describe("silentRefresh", () => {
  it("updates the installed packages without a toast or a loading state", async () => {
    const { task, dispatched } = start(silentRefresh);
    await flush();
    expect(task.isRunning()).toBe(false);
    expect(api.listPackages).toHaveBeenCalledWith(); // no { toastOnError } options
    expect(dispatched).toEqual([updateDnpInstalled([NIMBUS])]);
  });

  it("ignores a failure: nothing is dispatched, so no error screen and no toast", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    api.listPackages.mockRejectedValue(Error("Connection is not open"));
    const { task, dispatched } = start(silentRefresh);
    await flush();
    expect(task.isRunning()).toBe(false);
    expect(dispatched).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("drops its answer when a WAMP push lands while it is in flight", async () => {
    let answer;
    api.listPackages.mockReturnValue(new Promise(resolve => (answer = resolve)));
    const { task, dispatched, put } = start(silentRefresh);
    await flush();
    put(updateDnpInstalled([{ ...NIMBUS, state: "running", running: true }])); // the push
    answer([NIMBUS]); // older data
    await flush();
    expect(task.isRunning()).toBe(false);
    expect(dispatched.filter(x => x.type === UPDATE_DNP_INSTALLED)).toEqual([]);
  });

  it("gives up on a call that never answers", async () => {
    api.listPackages.mockReturnValue(new Promise(() => {}));
    const { task, dispatched } = start(silentRefresh);
    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_TIMEOUT_MS - 1);
    expect(task.isRunning()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(task.isRunning()).toBe(false);
    expect(dispatched).toEqual([]);
  });
});

describe("silentPoll", () => {
  it("refreshes every few minutes while the tab is visible", async () => {
    const { task, dispatched } = start(silentPoll);
    await flush();
    expect(api.listPackages).not.toHaveBeenCalled(); // CONNECTION_OPEN has just fetched

    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_MS);
    expect(api.listPackages).toHaveBeenCalledTimes(1);
    expect(dispatched).toEqual([updateDnpInstalled([NIMBUS])]);
    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_MS);
    expect(api.listPackages).toHaveBeenCalledTimes(2);
    task.cancel();
  });

  it("does not poll while the tab is hidden, and refreshes once when it is shown again", async () => {
    const { task } = start(silentPoll);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(3 * SILENT_REFRESH_MS);
    expect(api.listPackages).not.toHaveBeenCalled();

    setHidden(false);
    await flush();
    expect(api.listPackages).toHaveBeenCalledTimes(1);
    task.cancel();
  });

  it("switching tabs right after a refresh does not refresh again", async () => {
    const { task } = start(silentPoll);
    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_MS);
    expect(api.listPackages).toHaveBeenCalledTimes(1);

    setHidden(true);
    setHidden(false);
    await flush();
    expect(api.listPackages).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(VISIBLE_REFRESH_MIN_GAP_MS);
    setHidden(true);
    setHidden(false);
    await flush();
    expect(api.listPackages).toHaveBeenCalledTimes(2);
    task.cancel();
  });

  it("never starts a second call while one is in flight", async () => {
    api.listPackages.mockReturnValue(new Promise(() => {}));
    const { task } = start(silentPoll);
    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_MS);
    expect(api.listPackages).toHaveBeenCalledTimes(1);

    setHidden(true);
    setHidden(false); // would refresh, but the first call hasn't answered
    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_TIMEOUT_MS - 1);
    expect(api.listPackages).toHaveBeenCalledTimes(1);
    task.cancel();
  });

  it("stops listening to the tab when cancelled", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { task } = start(silentPoll);
    await flush();
    task.cancel();
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    remove.mockRestore();
  });
});

describe("dnpInstalled saga", () => {
  it("fetches on connect and runs one silent poll, even after a reconnect", async () => {
    const { task, put } = start(dnpInstalledSaga);
    put({ type: CONNECTION_OPEN });
    put({ type: CONNECTION_OPEN });
    await flush();
    expect(api.listPackages).toHaveBeenCalledTimes(2); // the regular fetch, with its error toast
    expect(silentCalls()).toBe(0);

    await vi.advanceTimersByTimeAsync(SILENT_REFRESH_MS);
    expect(silentCalls()).toBe(1);
    task.cancel();
  });
});
