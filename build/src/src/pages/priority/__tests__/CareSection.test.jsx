import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { useHealthMock, getSettings, setSettings, getStatusMock } = vi.hoisted(() => ({
  useHealthMock: vi.fn(),
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  getStatusMock: vi.fn()
}));

vi.mock("health/HealthProvider", () => ({ useHealth: useHealthMock }));
vi.mock("pages/priority/careApi", async importOriginal => ({
  ...(await importOriginal()),
  getCareSettings: getSettings,
  setCareSettings: setSettings,
  getCareStatus: getStatusMock
}));

import CareSection, { timeAgo } from "pages/priority/components/CareSection";

const CARE = "care.avado.dnp.dappnode.eth";
const NODE = "0x2c7536e3605d9c16a7a3d7b1898e529396a65c23";
const PREFS = { offline: true, critical: true, updates: true, monthly: false };
const minutesAgo = m => new Date(Date.now() - m * 60 * 1000).toISOString();

const settings = over => ({
  email: "owner@example.com",
  verified: true,
  prefs: PREFS,
  lastHeartbeatAt: minutesAgo(4),
  careInstalled: true,
  trialEligible: false,
  subscription: { status: "active" },
  ...over
});

const health = over => ({
  packages: [{ name: CARE, running: true }],
  storePackages: [],
  sources: { updates: "ok" },
  ...over
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <CareSection nodeId={NODE} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  useHealthMock.mockReturnValue(health());
  getSettings.mockResolvedValue(settings());
  setSettings.mockImplementation(async (_n, changes) => settings(changes.prefs ? { prefs: changes.prefs } : { email: changes.email, verified: false }));
  getStatusMock.mockResolvedValue({
    version: "0.1.0",
    lastHeartbeat: { at: minutesAgo(3), ok: true, error: null },
    verdict: "ok",
    findings: [],
    subscribed: true
  });
});

describe("Turn on alerts", () => {
  it("links to the installer by the store catalogue hash when the Care app is missing", async () => {
    useHealthMock.mockReturnValue(
      health({
        packages: [],
        storePackages: [{ manifest: { name: CARE }, manifesthash: "/ipfs/QmCare" }]
      })
    );
    renderSection();
    const link = screen.getByRole("link", { name: "Turn on alerts" });
    expect(link).toHaveAttribute("href", `/installer/${encodeURIComponent("/ipfs/QmCare")}`);
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    await screen.findByText(/Alerts go to/);
    expect(getStatusMock).not.toHaveBeenCalled();
  });

  it("shows Coming soon when the store does not list the Care app", async () => {
    useHealthMock.mockReturnValue(health({ packages: [], storePackages: [{ manifest: { name: "x.eth" }, manifesthash: "/ipfs/Qm" }] }));
    renderSection();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Turn on alerts" })).not.toBeInTheDocument();
    await screen.findByText(/Alerts go to/);
  });

  it("waits for the store instead of saying Coming soon", async () => {
    useHealthMock.mockReturnValue(health({ packages: [], storePackages: null, sources: { updates: "loading" } }));
    renderSection();
    expect(screen.getByText(/Checking the AVADO store/)).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    await screen.findByText(/Alerts go to/);
  });
});

describe("AVADO is watching your box", () => {
  it("shows the last heartbeat from the Care app", async () => {
    renderSection();
    expect(await screen.findByText("Watching")).toBeInTheDocument();
    expect(screen.getByText(/Last check-in: 3 minutes ago/)).toBeInTheDocument();
  });

  it("explains a failed check-in in plain words", async () => {
    getStatusMock.mockResolvedValue({ lastHeartbeat: { at: minutesAgo(2), ok: false, error: "timeout" } });
    renderSection();
    expect(await screen.findByText("Can't reach AVADO")).toBeInTheDocument();
    expect(screen.getByText(/could not reach AVADO/)).toBeInTheDocument();
  });

  it("flags an old heartbeat", async () => {
    getStatusMock.mockResolvedValue({ lastHeartbeat: { at: minutesAgo(90), ok: true, error: null } });
    renderSection();
    expect(await screen.findByText("No recent check-in")).toBeInTheDocument();
  });

  it("says the first check is coming when there is no heartbeat yet", async () => {
    getStatusMock.mockResolvedValue({ lastHeartbeat: null });
    renderSection();
    expect(await screen.findByText(/first check/)).toBeInTheDocument();
  });

  it("handles a Care app that does not answer, with the backend's last heartbeat", async () => {
    getStatusMock.mockRejectedValue(Object.assign(new Error("x"), { code: "care_unreachable" }));
    renderSection();
    expect(await screen.findByText("Not answering")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "its app page" })).toHaveAttribute("href", `/packages/${CARE}`);
    expect(await screen.findByText(/AVADO last heard from your box 4 minutes ago/)).toBeInTheDocument();
  });
});

describe("alerts email", () => {
  it("asks for an email when none is set and saves it", async () => {
    getSettings.mockResolvedValue(settings({ email: null, verified: false }));
    renderSection();
    const input = await screen.findByLabelText("Your email");
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setSettings).toHaveBeenCalledWith(NODE, { email: "new@example.com" }));
    expect(await screen.findByText(/We sent an email to/)).toBeInTheDocument();
    expect(screen.getByText("Not confirmed yet")).toBeInTheDocument();
  });

  it("rejects an invalid email without calling the backend", async () => {
    getSettings.mockResolvedValue(settings({ email: null }));
    renderSection();
    fireEvent.change(await screen.findByLabelText("Your email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(setSettings).not.toHaveBeenCalled();
  });

  it("re-checks the verification state on request", async () => {
    getSettings.mockResolvedValueOnce(settings({ verified: false })).mockResolvedValueOnce(settings());
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "I've confirmed it" }));
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(getSettings).toHaveBeenCalledTimes(2);
  });

  it("shows the system-update message when the DAPPMANAGER is too old", async () => {
    getSettings.mockRejectedValue(
      Object.assign(new Error("Your AVADO needs a system update before it can do this."), { code: "needs_update" })
    );
    renderSection();
    expect(await screen.findByText(/needs a system update/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open System" })).toHaveAttribute("href", "/system");
  });

  it("shows backend errors in plain words with a retry", async () => {
    getSettings
      .mockRejectedValueOnce(Object.assign(new Error("Could not reach the Priority Care service."), { code: "unreachable" }))
      .mockResolvedValueOnce(settings());
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the Priority Care service.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Alerts go to/)).toBeInTheDocument();
  });
});

describe("alert categories", () => {
  it("shows the four categories from the saved prefs", async () => {
    renderSection();
    await screen.findByText(/Alerts go to/);
    expect(screen.getByRole("switch", { name: "My AVADO goes offline" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Monthly health report" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(4);
  });

  it("saves the whole prefs object when one is switched", async () => {
    renderSection();
    await screen.findByText(/Alerts go to/);
    fireEvent.click(screen.getByRole("switch", { name: "Monthly health report" }));
    await waitFor(() =>
      expect(setSettings).toHaveBeenCalledWith(NODE, { prefs: { ...PREFS, monthly: true } })
    );
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Monthly health report" })).toHaveAttribute("aria-checked", "true")
    );
  });

  it("switches back and explains when saving fails", async () => {
    setSettings.mockRejectedValue(Object.assign(new Error("Too many attempts. Please wait a minute and try again."), { code: "rate_limited" }));
    renderSection();
    await screen.findByText(/Alerts go to/);
    const sw = screen.getByRole("switch", { name: "Serious problems" });
    fireEvent.click(sw);
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
    await waitFor(() => expect(screen.getByRole("switch", { name: "Serious problems" })).toHaveAttribute("aria-checked", "true"));
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  it.each([
    ["2026-09-24T11:59:40Z", "just now"],
    ["2026-09-24T11:59:00Z", "1 minute ago"],
    ["2026-09-24T11:15:00Z", "45 minutes ago"],
    ["2026-09-24T09:00:00Z", "3 hours ago"],
    ["2026-09-20T12:00:00Z", "4 days ago"],
    [null, ""]
  ])("%s -> %s", (at, expected) => expect(timeAgo(at, now)).toBe(expected));
});

