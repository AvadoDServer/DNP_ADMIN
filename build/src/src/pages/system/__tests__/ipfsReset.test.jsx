import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModeProvider } from "settings/ModeProvider";
import { IpfsResetButton, IpfsResetStatus, CONFIRM_TITLE, CONFIRM_TEXT } from "pages/system/components/IpfsReset";
import { SystemStorage } from "pages/system/components/SystemStorage";
import {
  startIpfsReset,
  noteIpfsHealth,
  resultText,
  ipfsResetState,
  getIpfsHealth,
  _resetIpfsResetState,
  PROGRESS_TEXT,
} from "pages/system/ipfsResetApi";

const { mockConfirm, api, session, toasts } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  api: { resetIpfsData: vi.fn(), getIpfsHealth: vi.fn() },
  session: { current: { id: "A" } },
  toasts: [],
}));
vi.mock("components/ConfirmDialog", () => ({ confirm: mockConfirm }));
vi.mock("API/rpcMethods", () => ({ default: api }));
vi.mock("API/start", () => ({ getSession: () => session.current }));
vi.mock("components/toast/Toast", () => ({
  default: vi.fn(function Toast(opts) {
    const t = { opts, resolve: vi.fn() };
    toasts.push(t);
    return t;
  }),
}));
vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ diskForecast: { state: "none" }, diskTrendStatus: "not-installed" }) }));

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const RESULT = { removedKb: 1258291, restarted: true, peersConnected: 14, storePeersConnected: 1 };

beforeEach(() => {
  _resetIpfsResetState();
  mockConfirm.mockClear();
  api.resetIpfsData.mockReset();
  api.getIpfsHealth.mockReset();
  toasts.length = 0;
  session.current = { id: "A" };
  localStorage.clear();
});

const renderControls = () =>
  render(
    <div>
      <IpfsResetButton origin="finding" variant="primary" />
      <IpfsResetStatus />
    </div>
  );

// Press the button and confirm in the dialog
async function pressAndConfirm() {
  fireEvent.click(screen.getByRole("button", { name: "Reset IPFS storage" }));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  const opts = mockConfirm.mock.calls[0][0];
  await act(async () => {
    opts.onClick();
  });
  return opts;
}

describe("Reset IPFS storage button", () => {
  it("asks first, with a primary confirm in plain words; nothing is sent before", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Reset IPFS storage" }));
    const opts = mockConfirm.mock.calls[0][0];
    expect(opts).toMatchObject({ title: CONFIRM_TITLE, text: CONFIRM_TEXT, label: "Reset IPFS storage", variant: "primary" });
    expect(opts.text).toContain("your apps and their data are not touched");
    expect(opts.text).not.toMatch(/docker|volume|dncore|container/i);
    expect(api.resetIpfsData).not.toHaveBeenCalled();
  });

  it("confirm → call → progress → done", async () => {
    const call = deferred();
    api.resetIpfsData.mockReturnValue(call.promise);
    renderControls();
    await pressAndConfirm();

    expect(api.resetIpfsData).toHaveBeenCalledTimes(1);
    expect(api.resetIpfsData).toHaveBeenCalledWith({});
    expect(screen.getByRole("status")).toHaveTextContent(PROGRESS_TEXT);
    expect(screen.getByRole("button", { name: /Reset IPFS storage/ })).toBeDisabled();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].opts).toEqual({ message: PROGRESS_TEXT, pending: true });

    await act(async () => {
      call.resolve(RESULT);
      await call.promise;
    });
    expect(screen.getByRole("status")).toHaveTextContent("Done: 1.3 GB removed, IPFS is running again");
    expect(screen.getByRole("button", { name: "Reset IPFS storage" })).not.toBeDisabled();
    expect(toasts[0].resolve).toHaveBeenCalledWith({ success: true, message: "Done: 1.3 GB removed, IPFS is running again" });
  });

  it("confirm → call → the DAPPMANAGER's error", async () => {
    const message = "IPFS storage was emptied but IPFS did not start again. Restart your AVADO or contact AVADO support.";
    api.resetIpfsData.mockRejectedValue(Error(message));
    renderControls();
    await pressAndConfirm();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
    expect(toasts[0].resolve).toHaveBeenCalledWith({ success: false, message });
  });

  it("a second click while one runs never sends a second reset", async () => {
    const call = deferred();
    api.resetIpfsData.mockReturnValue(call.promise);
    const first = startIpfsReset({ origin: "storage" });
    const second = startIpfsReset({ origin: "finding" });
    expect(second).toBe(first);
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.resetIpfsData).toHaveBeenCalledTimes(1);
    await act(async () => {
      call.resolve(RESULT);
      await first;
    });
    expect(ipfsResetState()).toMatchObject({ status: "done", origin: "storage" });
  });

  it("the progress started on one page shows on another (Home and System > Storage share it)", async () => {
    const call = deferred();
    api.resetIpfsData.mockReturnValue(call.promise);
    startIpfsReset({ origin: "storage" });
    renderControls();
    expect(screen.getByRole("status")).toHaveTextContent(PROGRESS_TEXT);
    await act(async () => {
      call.resolve(RESULT);
      await call.promise;
    });
  });
});

describe("resultText", () => {
  it("says how much was removed and whether IPFS runs", () => {
    expect(resultText(RESULT)).toBe("Done: 1.3 GB removed, IPFS is running again");
    expect(resultText({ ...RESULT, removedKb: null })).toBe("Done: IPFS storage emptied, IPFS is running again");
    expect(resultText({ ...RESULT, restarted: false })).toBe(
      "Done: 1.3 GB removed. IPFS is still starting; check again in a few minutes."
    );
  });
});

describe("noteIpfsHealth: a reset whose answer was lost with the connection", () => {
  const healthyIpfs = { exists: true, running: true, restarting: false, resetRunning: false };

  async function startOnSessionA() {
    api.resetIpfsData.mockReturnValue(new Promise(() => {})); // never settles
    startIpfsReset({ origin: "finding" });
    // let the session lookup finish
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
  }

  it("same session: waits for the answer", async () => {
    await startOnSessionA();
    await noteIpfsHealth(healthyIpfs, { sessionImpl: () => session.current });
    expect(ipfsResetState().status).toBe("running");
  });

  it("new session and the DAPPMANAGER no longer runs it: settled from the health", async () => {
    await startOnSessionA();
    await noteIpfsHealth({ ...healthyIpfs, resetRunning: true }, { sessionImpl: () => ({ id: "B" }) });
    expect(ipfsResetState().status).toBe("running");
    await noteIpfsHealth(healthyIpfs, { sessionImpl: () => ({ id: "B" }) });
    expect(ipfsResetState()).toMatchObject({ status: "done", origin: "finding" });
    expect(ipfsResetState().text).toMatch(/finished while this page was not connected/);
  });

  it("new session and IPFS still restarting: not sure, contact support", async () => {
    await startOnSessionA();
    await noteIpfsHealth({ ...healthyIpfs, running: false, restarting: true }, { sessionImpl: () => ({ id: "B" }) });
    expect(ipfsResetState().status).toBe("error");
    expect(ipfsResetState().text).toMatch(/contact AVADO support/);
  });
});

describe("noteIpfsHealth: unknown session, and a reset this page did not start", () => {
  it("a reset sent while the session was unknown is settled from the health, but not in its first 30 s", async () => {
    session.current = null;
    api.resetIpfsData.mockReturnValue(new Promise(() => {}));
    startIpfsReset({ origin: "finding" });
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    const ok = { exists: true, running: true, restarting: false, resetRunning: false };
    await noteIpfsHealth(ok, { sessionImpl: () => null, now: Date.now() + 5000 });
    expect(ipfsResetState().status).toBe("running");
    await noteIpfsHealth(ok, { sessionImpl: () => null, now: Date.now() + 31 * 1000 });
    expect(ipfsResetState()).toMatchObject({ status: "done", origin: "finding" });
    expect(typeof ipfsResetState().endedAt).toBe("number");
  });

  it("after a reload: resetRunning shows the reset as running (button busy) until it ends", async () => {
    renderControls();
    await act(async () => {
      await noteIpfsHealth({ exists: true, running: false, restarting: false, resetRunning: true });
    });
    expect(screen.getByRole("status")).toHaveTextContent(PROGRESS_TEXT);
    expect(screen.getByRole("button", { name: /Reset IPFS storage/ })).toBeDisabled();
    await act(async () => {
      await noteIpfsHealth({ exists: true, running: true, restarting: false, resetRunning: false });
    });
    expect(ipfsResetState()).toMatchObject({ status: "done" });
    expect(screen.getByRole("button", { name: "Reset IPFS storage" })).not.toBeDisabled();
  });

  it("a finished reset records when it ended", async () => {
    api.resetIpfsData.mockResolvedValue(RESULT);
    await startIpfsReset({ origin: "finding" });
    expect(ipfsResetState()).toMatchObject({ status: "done", origin: "finding" });
    expect(Date.now() - ipfsResetState().endedAt).toBeLessThan(5000);
  });
});

describe("getIpfsHealth", () => {
  it("asks the DAPPMANAGER", async () => {
    api.getIpfsHealth.mockResolvedValue({ exists: true });
    expect(await getIpfsHealth()).toEqual({ exists: true });
    expect(api.getIpfsHealth).toHaveBeenCalledWith({});
  });
});

describe("System > Storage: IPFS storage", () => {
  const IPFS = { name: "ipfs.dnp.dappnode.eth", isCore: true, volumes: [{ size: "1.3GB" }], manifest: { title: "AVADO IPFS node" } };
  const dm = version => ({ name: "dappmanager.dnp.dappnode.eth", isCore: true, version });
  const renderPage = packages =>
    render(
      <ModeProvider>
        <MemoryRouter>
          <SystemStorage dnpInstalled={packages} dappnodeStats={{ disk: "50%" }} runSignedCmd={() => {}} />
        </MemoryRouter>
      </ModeProvider>
    );

  it("offers the reset, secondary, with the same confirm, from DAPPMANAGER 10.0.52", async () => {
    renderPage([IPFS, dm("10.0.52")]);
    expect(screen.getByText("IPFS storage")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Reset IPFS storage" });
    expect(button.className).toContain("bg-surface"); // secondary
    fireEvent.click(button);
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({ title: CONFIRM_TITLE, variant: "primary" });
  });

  it("hides it with a DAPPMANAGER before 10.0.52, or without IPFS", () => {
    renderPage([IPFS, dm("10.0.51")]);
    expect(screen.queryByRole("button", { name: "Reset IPFS storage" })).not.toBeInTheDocument();
    expect(screen.queryByText("IPFS storage")).not.toBeInTheDocument();
  });

  it("hides it without the IPFS package", () => {
    renderPage([dm("10.0.52")]);
    expect(screen.queryByRole("button", { name: "Reset IPFS storage" })).not.toBeInTheDocument();
  });
});
