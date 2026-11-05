import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { platform, deviceName, isStandalone, pushSupported, registerServiceWorker } from "pwa/device";
import { keyToBytes, errorText, turnOn, turnOff, sendTest, readState, TEXTS } from "pwa/pushApi";
import { AlertsCard, HomeScreenHint, blocker, hintFor, TEST_SENT_TEXT, ALERTS_PATH } from "pwa/PhoneAlerts";
import { canUsePushAlerts, pushAlertsNeedUpdate } from "health/clients";
import { wampUrl, ipfsGateway, ipfsSwarmConnectUrl, isBlockedFrame, isBoxHostname } from "utils/boxUrls";

const { state } = vi.hoisted(() => ({ state: { packages: [], versionData: null } }));
vi.mock("react-redux", () => ({ useSelector: selector => selector() }));
vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: () => state.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({ getDappmanagerVersionData: () => state.versionData }));

const core = version => [{ name: "dappmanager.dnp.dappnode.eth", version, isCore: true }];
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const KEY = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";

beforeEach(() => {
  state.packages = core("10.0.59");
  state.versionData = null;
  localStorage.clear();
});

describe("box addresses", () => {
  it("http://my.ava.do keeps the direct addresses (jsdom runs on http://localhost)", () => {
    expect(wampUrl()).toBe("ws://wamp.my.ava.do:8080/ws");
    expect(ipfsGateway()).toBe("http://ipfs.my.ava.do:8080/ipfs/");
    expect(ipfsSwarmConnectUrl()).toBe("http://ipfs.my.ava.do:5001/api/v0/swarm/connect?arg=");
    expect(isBlockedFrame("http://bitcoin.my.ava.do")).toBe(false);
  });
  it("names of the box", () => {
    expect(isBoxHostname("my.ava.do")).toBe(true);
    expect(isBoxHostname("admin.my.ava.do")).toBe(true);
    expect(isBoxHostname("172.33.1.9")).toBe(false);
    expect(isBoxHostname("evilmy.ava.do")).toBe(false);
  });
});

describe("device", () => {
  it("platform and device names", () => {
    expect(platform(IPHONE)).toBe("iphone");
    expect(platform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 5)).toBe("ipad");
    expect(platform(ANDROID)).toBe("android");
    expect(platform(MAC_CHROME, 0)).toBe("desktop");
    expect(deviceName(IPHONE)).toBe("iPhone");
    expect(deviceName(ANDROID)).toBe("Android phone");
    expect(deviceName(MAC_CHROME, 0)).toBe("Chrome on Mac");
  });
  it("standalone: iOS flag or display-mode", () => {
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false);
  });
  it("no service worker and no push on an insecure page", async () => {
    const register = vi.fn();
    expect(await registerServiceWorker({ isSecureContext: false, navigator: { serviceWorker: { register } } })).toBe(null);
    expect(register).not.toHaveBeenCalled();
    expect(pushSupported({ isSecureContext: false, navigator: { serviceWorker: {} }, PushManager: {}, Notification: {} })).toBe(false);
    register.mockResolvedValue("reg");
    expect(await registerServiceWorker({ isSecureContext: true, navigator: { serviceWorker: { register } } })).toBe("reg");
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });
});

describe("push api", () => {
  it("decodes the VAPID key to 65 bytes", () => {
    const b = keyToBytes(KEY);
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });
  it("errors as sentences", () => {
    expect(errorText(Error("wamp.error.no_such_procedure"))).toBe(TEXTS.oldCore);
    expect(errorText(Error("Connection is not open"))).toBe(TEXTS.lost);
    expect(errorText(Error("Alerts are not on for this device. Turn them on first."))).toBe("Alerts are not on for this device. Turn them on first.");
    expect(errorText(Error("DOMException: AbortError"))).toBe(TEXTS.failed);
  });

  function browser({ permission = "granted", existing = null } = {}) {
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/x",
      options: { applicationServerKey: keyToBytes(KEY).buffer },
      toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "p", auth: "a" } }),
      unsubscribe: vi.fn(async () => true)
    };
    const pushManager = { getSubscription: vi.fn(async () => existing || null), subscribe: vi.fn(async () => sub) };
    globalThis.Notification = { permission, requestPermission: vi.fn(async () => permission) };
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    window.PushManager = function PushManager() {};
    Object.defineProperty(navigator, "serviceWorker", { value: { ready: Promise.resolve({ pushManager }) }, configurable: true });
    return { sub, pushManager };
  }
  const boxStub = () => ({
    getKey: vi.fn(async () => KEY),
    subscribe: vi.fn(async () => null),
    unsubscribe: vi.fn(async () => null),
    status: vi.fn(async () => ({ subscribed: true, devices: 1 })),
    test: vi.fn(async () => null)
  });

  it("turns on: permission, subscribe with the box key, hand it to the box", async () => {
    const { pushManager } = browser({ existing: undefined });
    const box = boxStub();
    await turnOn(box);
    expect(pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyToBytes(KEY) });
    expect(box.subscribe.mock.calls[0][0].endpoint).toBe("https://fcm.googleapis.com/fcm/send/x");
    expect(typeof box.subscribe.mock.calls[0][1]).toBe("string");
  });

  it("a subscription made with another box key is replaced", async () => {
    const old = { endpoint: "https://old", options: { applicationServerKey: new Uint8Array(65).buffer }, unsubscribe: vi.fn(async () => true) };
    const { pushManager } = browser({ existing: old });
    await turnOn(boxStub());
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("blocked or not allowed: plain sentences, nothing sent to the box", async () => {
    browser({ permission: "denied", existing: undefined });
    const box = boxStub();
    await expect(turnOn(box)).rejects.toThrow(TEXTS.denied);
    browser({ permission: "default", existing: undefined });
    await expect(turnOn(box)).rejects.toThrow(TEXTS.notAllowed);
    expect(box.subscribe).not.toHaveBeenCalled();
  });

  it("state, test and off", async () => {
    const { sub } = browser({ existing: undefined });
    const existing = { ...sub, unsubscribe: vi.fn(async () => true) };
    browser({ existing });
    const box = boxStub();
    expect(await readState(box)).toEqual({ on: true, permission: "granted" });
    await sendTest(box);
    expect(box.test).toHaveBeenCalledWith(existing.endpoint);
    await turnOff(box);
    expect(box.unsubscribe).toHaveBeenCalledWith(existing.endpoint);
    expect(existing.unsubscribe).toHaveBeenCalled();
  });
});

describe("version gate", () => {
  it("needs DAPPMANAGER 10.0.59", () => {
    expect(canUsePushAlerts(core("10.0.58"))).toBe(false);
    expect(canUsePushAlerts(core("10.0.59"))).toBe(true);
    expect(canUsePushAlerts(core("10.0.54"), "10.0.59")).toBe(true);
    expect(pushAlertsNeedUpdate(core("10.0.57"))).toBe(true);
    expect(pushAlertsNeedUpdate([])).toBe(false);
  });
});

describe("what the card and the hint offer", () => {
  const base = { secure: true, boxHost: true, apple: false, standalone: false, supported: true };
  it("blocker", () => {
    expect(blocker(base)).toBe(null);
    expect(blocker({ ...base, secure: false }).action).toBe("secure");
    expect(blocker({ ...base, secure: false, boxHost: false }).text).toMatch(/https:\/\/admin\.my\.ava\.do/);
    expect(blocker({ ...base, apple: true }).text).toMatch(/Add to Home Screen/);
    expect(blocker({ ...base, apple: true, standalone: true })).toBe(null);
    expect(blocker({ ...base, supported: false }).text).toMatch(/cannot get alerts/);
  });
  it("hint", () => {
    const phone = { phone: true, secure: true, boxHost: true, standalone: false, apple: false, android: true, canPrompt: false };
    expect(hintFor({ ...phone, phone: false })).toBe(null);
    expect(hintFor({ ...phone, secure: false }).action).toBe("secure");
    expect(hintFor({ ...phone, secure: false, boxHost: false })).toBe(null);
    expect(hintFor({ ...phone, canPrompt: true }).action).toBe("install");
    expect(hintFor(phone).text).toMatch(/browser menu/);
    expect(hintFor({ ...phone, android: false, apple: true }).text).toMatch(/Share button/);
    expect(hintFor({ ...phone, standalone: true })).toMatchObject({ action: "alerts", label: "Turn on alerts" });
  });
});

describe("AlertsCard", () => {
  const env = { secure: true, boxHost: true, apple: false, standalone: true, supported: true };
  const apiStub = (on = false) => ({
    readState: vi.fn(async () => ({ on, permission: "default" })),
    turnOn: vi.fn(async () => {}),
    turnOff: vi.fn(async () => {}),
    sendTest: vi.fn(async () => {})
  });
  const renderCard = props =>
    render(
      <MemoryRouter>
        <AlertsCard {...props} />
      </MemoryRouter>
    );

  it("one switch; turning on shows the test button; the test confirms", async () => {
    const api = apiStub(false);
    renderCard({ env, api });
    const sw = await screen.findByRole("switch", { name: "Send alerts to this phone" });
    await waitFor(() => expect(sw).not.toBeDisabled());
    expect(screen.queryByRole("button", { name: "Send a test alert" })).toBeNull();
    fireEvent.click(sw);
    await screen.findByText("Alerts are on for this device.");
    expect(api.turnOn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send a test alert" }));
    await screen.findByText(TEST_SENT_TEXT);
  });

  it("an error is shown as it comes", async () => {
    const api = apiStub(false);
    api.turnOn.mockRejectedValue(Error(TEXTS.denied));
    renderCard({ env, api });
    const sw = await screen.findByRole("switch");
    await waitFor(() => expect(sw).not.toBeDisabled());
    fireEvent.click(sw);
    expect((await screen.findByRole("alert")).textContent).toBe(TEXTS.denied);
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("on http: a button to the secure address, no switch", () => {
    renderCard({ env: { ...env, secure: false }, api: apiStub() });
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByRole("link", { name: "Open the secure address" }).getAttribute("href")).toMatch(/^https:\/\/admin\.my\.ava\.do\/#/);
  });

  it("an old core: update first, nothing asked", () => {
    state.packages = core("10.0.57");
    const api = apiStub();
    renderCard({ env, api });
    expect(screen.getByText(TEXTS.oldCore)).toBeTruthy();
    expect(api.readState).not.toHaveBeenCalled();
  });
});

describe("HomeScreenHint", () => {
  const phone = { phone: true, secure: true, boxHost: true, standalone: true, apple: false, android: true, canPrompt: false };
  it("from the home screen: Turn on alerts opens the alerts page; Not now is remembered", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <HomeScreenHint env={phone} />
        <Route path={ALERTS_PATH} render={() => <p>alerts page</p>} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Turn on alerts" }));
    expect(screen.getByText("alerts page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    unmount();
    render(
      <MemoryRouter>
        <HomeScreenHint env={phone} />
      </MemoryRouter>
    );
    expect(screen.queryByText("AVADO on your phone")).toBeNull();
  });
  it("not on an old core, not on a computer", () => {
    state.packages = core("10.0.57");
    const { container } = render(
      <MemoryRouter>
        <HomeScreenHint env={phone} />
      </MemoryRouter>
    );
    expect(container.textContent).toBe("");
    state.packages = core("10.0.59");
    const r2 = render(
      <MemoryRouter>
        <HomeScreenHint env={{ ...phone, phone: false }} />
      </MemoryRouter>
    );
    expect(r2.container.textContent).toBe("");
  });
});
