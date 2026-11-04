import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { PackageSettings } from "pages/packages/components/PackageViews/Settings";

let mockMode = "simple";
vi.mock("settings/ModeProvider", () => ({
  useMode: () => ({ mode: mockMode, isAdvanced: mockMode === "advanced", setMode: () => {} }),
}));

const SECRET = "tskey-auth-current-secret";
const NAME = "vaultwarden.avado.dnp.dappnode.eth";

const manifest = {
  name: NAME,
  image: { environment: ["SIGNUPS_ALLOWED=true", "ADMIN_TOKEN=", "LANGUAGE=eng", "DOMAIN=https://vault.my.ava.do", "EXTRA="] },
  setupWizard: {
    version: "2",
    fields: [
      { id: "token", target: { type: "environment", name: "ADMIN_TOKEN" }, title: "Admin password", description: "Opens the [admin page](https://vault.my.ava.do/admin).", secret: true },
      { id: "signups", target: { type: "environment", name: "SIGNUPS_ALLOWED" }, title: "New accounts allowed", description: "Let people make an account.", enum: ["true", "false"] },
      { id: "lang", target: { type: "environment", name: "LANGUAGE" }, title: "Document language", description: "Used to read text in scans.", enum: ["eng", "deu", "slv"] },
      { id: "domain", target: { type: "environment", name: "DOMAIN" }, title: "Address", description: "Where people open it." }
    ]
  }
};
const dnp = (envs = {}) => ({ name: NAME, manifest, envs: { SIGNUPS_ALLOWED: "true", ADMIN_TOKEN: SECRET, LANGUAGE: "eng", DOMAIN: "https://vault.my.ava.do", EXTRA: "x", ...envs } });

const store = createStore(() => ({}));
const renderSettings = (props) =>
  render(
    <Provider store={store}>
      <PackageSettings {...props} />
    </Provider>
  );

beforeEach(() => {
  mockMode = "simple";
});

describe("Settings tab with setup fields", () => {
  it("shows each field with its title and help, plain words only, no raw env table in Simple mode", () => {
    renderSettings({ dnp: dnp(), updateEnvs: vi.fn() });
    expect(screen.getByText("Admin password")).toBeInTheDocument();
    expect(screen.getByText("New accounts allowed")).toBeInTheDocument();
    expect(screen.getByText("Document language")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toHaveValue("https://vault.my.ava.do");
    expect(screen.getByText("admin page").closest("a")).toHaveAttribute("href", "https://vault.my.ava.do/admin");
    expect(screen.getByRole("button", { name: "Save and restart" })).toBeDisabled();
    expect(screen.queryByText("Update environment variables")).toBeNull();
    expect(screen.queryByText("Advanced")).toBeNull();
    expect(screen.queryByText("SIGNUPS_ALLOWED")).toBeNull();
  });

  it("never pre-fills a secret, and never puts it in the page", () => {
    const { container } = renderSettings({ dnp: dnp(), updateEnvs: vi.fn() });
    const input = screen.getByLabelText("Admin password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("");
    expect(screen.getByText(/Leave empty to keep the current value/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(SECRET);
  });

  it("says Not set for a secret without a value", () => {
    renderSettings({ dnp: dnp({ ADMIN_TOKEN: "" }), updateEnvs: vi.fn() });
    expect(screen.getByLabelText("Admin password")).toHaveAttribute("placeholder", "Not set");
    expect(screen.queryByText(/Leave empty to keep/)).toBeNull();
  });

  it("a switch and a drop-down show the current values", () => {
    renderSettings({ dnp: dnp({ SIGNUPS_ALLOWED: "false", LANGUAGE: "deu" }), updateEnvs: vi.fn() });
    expect(screen.getByRole("switch", { name: "New accounts allowed" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText(/Document language/)).toHaveValue("deu");
  });

  it("Save and restart sends only what changed, through updatePackageEnv", async () => {
    const updateEnvs = vi.fn(() => Promise.resolve());
    renderSettings({ dnp: dnp(), updateEnvs });
    fireEvent.click(screen.getByRole("switch", { name: "New accounts allowed" }));
    fireEvent.change(screen.getByLabelText(/Document language/), { target: { value: "slv" } });
    const save = screen.getByRole("button", { name: "Save and restart" });
    expect(save).not.toBeDisabled();
    await act(async () => fireEvent.click(save));
    expect(updateEnvs).toHaveBeenCalledTimes(1);
    expect(updateEnvs).toHaveBeenCalledWith(NAME, { SIGNUPS_ALLOWED: "false", LANGUAGE: "slv" });
  });

  it("sends a typed secret (trimmed) and clears it from the page afterwards", async () => {
    const updateEnvs = vi.fn(() => Promise.resolve());
    renderSettings({ dnp: dnp(), updateEnvs });
    const input = screen.getByLabelText("Admin password");
    fireEvent.change(input, { target: { value: "  new-secret  " } });
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(input).toHaveAttribute("type", "text");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save and restart" })));
    expect(updateEnvs).toHaveBeenCalledWith(NAME, { ADMIN_TOKEN: "new-secret" });
    expect(input).toHaveValue("");
  });

  it("keeps what the owner is typing when the package list refreshes with the same values", () => {
    const { rerender } = renderSettings({ dnp: dnp(), updateEnvs: vi.fn() });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "https://other" } });
    rerender(
      <Provider store={store}>
        <PackageSettings dnp={dnp()} updateEnvs={vi.fn()} />
      </Provider>
    );
    expect(screen.getByLabelText("Address")).toHaveValue("https://other");
  });

  it("Advanced mode: the raw env table under Advanced, without the secret field", () => {
    mockMode = "advanced";
    const { container } = renderSettings({ dnp: dnp(), updateEnvs: vi.fn() });
    expect(screen.getByText("Advanced").tagName).toBe("SUMMARY");
    expect(screen.getByText("Update environment variables")).toBeInTheDocument();
    expect(screen.getByText("EXTRA")).toBeInTheDocument();
    expect(screen.getByText("SIGNUPS_ALLOWED")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN_TOKEN")).toBeNull();
    expect(container.innerHTML).not.toContain(SECRET);
  });
});

describe("Settings tab without setup fields", () => {
  it("is the environment table exactly as before", () => {
    mockMode = "advanced";
    const plain = { name: "x.avado.dnp.dappnode.eth", manifest: { image: { environment: ["A=1"] } }, envs: { B: "2" } };
    renderSettings({ dnp: plain, updateEnvs: vi.fn() });
    expect(screen.getByText("Environment variables")).toBeInTheDocument();
    expect(screen.getByLabelText("A")).toHaveValue("1");
    expect(screen.getByLabelText("B")).toHaveValue("2");
    expect(screen.getByText("Update environment variables")).toBeInTheDocument();
    expect(screen.queryByText("Save and restart")).toBeNull();
    expect(screen.queryByText("Advanced")).toBeNull();
  });
});
