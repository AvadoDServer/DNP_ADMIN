import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import {
  newPasswordProblem,
  errorText,
  changeBoxPassword,
  loadIsDefault,
  _resetBoxPasswordState,
  SUCCESS_TEXT,
  NOT_SAME_TEXT,
  OLD_CORE_TEXT,
  LOST_TEXT,
  FAILED_TEXT,
} from "pages/system/boxPasswordApi";
import { BoxPasswordForm, BoxPasswordCard, DefaultPasswordNotice } from "pages/system/components/BoxPassword";
import { canChangeBoxPassword, boxPasswordNeedsUpdate } from "health/clients";

const { state, api } = vi.hoisted(() => ({
  state: { packages: [], versionData: null },
  api: { passwordChange: vi.fn(), passwordIsSecure: vi.fn() },
}));
vi.mock("react-redux", () => ({ useSelector: selector => selector() }));
vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: () => state.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({ getDappmanagerVersionData: () => state.versionData }));
vi.mock("API/rpcMethods", () => ({ default: api }));

const core = version => [{ name: "dappmanager.dnp.dappnode.eth", version, isCore: true }];

beforeEach(() => {
  _resetBoxPasswordState();
  localStorage.clear();
  state.packages = core("10.0.57");
  state.versionData = null;
  api.passwordChange.mockReset();
  api.passwordIsSecure.mockReset();
});

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = () => fireEvent.click(screen.getByRole("button", { name: "Change password" }));

describe("box password rules", () => {
  it("matches the DAPPMANAGER's rules", () => {
    expect(newPasswordProblem("", "avado")).toBe("Type a new password.");
    expect(newPasswordProblem("avado", "x")).toBe("Choose a password other than avado.");
    expect(newPasswordProblem(" AVADO  ", "x")).toBe("Choose a password other than avado.");
    expect(newPasswordProblem("seven77", "avado")).toBe("The new password must have at least 8 characters.");
    expect(newPasswordProblem("čšžčšžčš", "avado")).toBe(null);
    expect(newPasswordProblem("two\nlines!", "avado")).toMatch(/line breaks/);
    expect(newPasswordProblem("x".repeat(129), "avado")).toMatch(/at most 128/);
    expect(newPasswordProblem("same old pass", "same old pass")).toMatch(/different from the current/);
    expect(newPasswordProblem("good password 1", "avado")).toBe(null);
  });

  it("shows the DAPPMANAGER's sentences and turns technical errors into plain ones", () => {
    expect(errorText(Error("The current password is wrong."))).toBe("The current password is wrong.");
    expect(errorText(Error("wamp.error.no_such_procedure"))).toBe(OLD_CORE_TEXT);
    expect(errorText(Error("Connection is not open"))).toBe(LOST_TEXT);
    expect(errorText(Error("TypeError: x is undefined"))).toBe(FAILED_TEXT);
  });

  it("needs DAPPMANAGER 10.0.57", () => {
    expect(canChangeBoxPassword(core("10.0.56"))).toBe(false);
    expect(canChangeBoxPassword(core("10.0.57"))).toBe(true);
    expect(canChangeBoxPassword(core("10.0.54"), "10.0.57")).toBe(true);
    expect(boxPasswordNeedsUpdate(core("10.0.54"))).toBe(true);
    // Still loading: no "update first" message
    expect(boxPasswordNeedsUpdate([])).toBe(false);
  });
});

describe("BoxPasswordForm", () => {
  it("changes the password with one button and says what to do next", async () => {
    const changeImpl = vi.fn().mockResolvedValue(null);
    render(<BoxPasswordForm changeImpl={changeImpl} />);
    fill("Current password", "avado");
    fill("New password", "my own secret 1");
    fill("New password again", "my own secret 1");
    press();
    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument();
    expect(changeImpl).toHaveBeenCalledWith({ currentPassword: "avado", newPassword: "my own secret 1" });
    // The form forgets the passwords
    expect(screen.getByLabelText("Current password").value).toBe("");
    expect(screen.getByLabelText("New password").value).toBe("");
    expect(screen.getByLabelText("New password again").value).toBe("");
  });

  it("asks for every field before sending anything", () => {
    const changeImpl = vi.fn();
    render(<BoxPasswordForm changeImpl={changeImpl} />);
    press();
    expect(screen.getByText("Type your current password.")).toBeInTheDocument();
    expect(screen.getByText("Type a new password.")).toBeInTheDocument();
    expect(screen.getByText("Type the new password again.")).toBeInTheDocument();
    expect(changeImpl).not.toHaveBeenCalled();
  });

  it("refuses a weak password or two different new passwords without sending", () => {
    const changeImpl = vi.fn();
    render(<BoxPasswordForm changeImpl={changeImpl} />);
    fill("Current password", "avado");
    fill("New password", "short");
    fill("New password again", "shorter");
    press();
    expect(screen.getByText("The new password must have at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText(NOT_SAME_TEXT)).toBeInTheDocument();
    expect(changeImpl).not.toHaveBeenCalled();
  });

  it("shows the DAPPMANAGER's refusal and keeps the fields; logs no password", async () => {
    const spies = ["log", "debug", "info", "warn", "error"].map(m => vi.spyOn(console, m).mockImplementation(() => {}));
    const changeImpl = vi.fn().mockRejectedValue(Error("The current password is wrong."));
    render(<BoxPasswordForm changeImpl={changeImpl} />);
    fill("Current password", "guess1234");
    fill("New password", "my own secret 1");
    fill("New password again", "my own secret 1");
    press();
    expect(await screen.findByRole("alert")).toHaveTextContent("The current password is wrong.");
    expect(screen.getByLabelText("New password").value).toBe("my own secret 1");
    const printed = JSON.stringify(spies.map(s => s.mock.calls));
    expect(printed).not.toMatch(/guess1234|my own secret 1/);
    spies.forEach(s => s.mockRestore());
  });

  it("each field has its own Show switch", () => {
    render(<BoxPasswordForm changeImpl={vi.fn()} />);
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Current password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Hide new password" }));
    expect(field).toHaveAttribute("type", "password");
    expect(screen.getAllByRole("button", { name: /^Show / })).toHaveLength(3);
  });

  it("only one change at a time", async () => {
    let finish;
    const changeImpl = vi.fn(() => new Promise(resolve => (finish = resolve)));
    render(<BoxPasswordForm changeImpl={changeImpl} />);
    fill("Current password", "avado");
    fill("New password", "my own secret 1");
    fill("New password again", "my own secret 1");
    press();
    const button = screen.getByRole("button", { name: /Changing/ });
    expect(button).toBeDisabled();
    fireEvent.submit(button.closest("form"));
    expect(changeImpl).toHaveBeenCalledTimes(1);
    await act(async () => finish(null));
    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument();
  });
});

describe("BoxPasswordCard", () => {
  it("says the factory password is still in use", async () => {
    render(
      <MemoryRouter>
        <BoxPasswordCard checkImpl={() => Promise.resolve(false)} />
      </MemoryRouter>
    );
    expect(await screen.findByText(/still uses the factory password/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Change box password" })).toBeInTheDocument();
  });

  it("an older core: asks for the update instead of showing the form", () => {
    state.packages = core("10.0.54");
    const checkImpl = vi.fn();
    render(
      <MemoryRouter>
        <BoxPasswordCard checkImpl={checkImpl} />
      </MemoryRouter>
    );
    expect(screen.getByText(OLD_CORE_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Updates" })).toHaveAttribute("href", "/system/updates");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(checkImpl).not.toHaveBeenCalled();
  });

  it("goes through the real call: passwordChange gets both passwords, the notice state updates", async () => {
    api.passwordChange.mockResolvedValue(null);
    await loadIsDefault(() => Promise.resolve(false));
    await changeBoxPassword({ currentPassword: "avado", newPassword: "my own secret 1" });
    expect(api.passwordChange).toHaveBeenCalledWith({ currentPassword: "avado", newPassword: "my own secret 1" });
  });
});

describe("DefaultPasswordNotice", () => {
  const renderNotice = (checkImpl, path = "/dashboard") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <DefaultPasswordNotice checkImpl={checkImpl} />
        <Route path="/system/password" render={() => <p>password page</p>} />
      </MemoryRouter>
    );

  it("shows while the password is avado and opens the password page", async () => {
    renderNotice(() => Promise.resolve(false));
    expect(await screen.findByText("Change your AVADO's password")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("password page")).toBeInTheDocument();
  });

  it("Not now hides it, also next time", async () => {
    const { unmount } = renderNotice(() => Promise.resolve(false));
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Change your AVADO's password")).not.toBeInTheDocument();
    unmount();
    renderNotice(() => Promise.resolve(false));
    await waitFor(() => expect(screen.queryByText("Change your AVADO's password")).not.toBeInTheDocument());
  });

  it("nothing when the password was changed, unknown, or the core is too old", async () => {
    renderNotice(() => Promise.resolve(true));
    await act(async () => {});
    expect(screen.queryByText("Change your AVADO's password")).not.toBeInTheDocument();
    _resetBoxPasswordState();
    renderNotice(() => Promise.resolve(null));
    await act(async () => {});
    expect(screen.queryByText("Change your AVADO's password")).not.toBeInTheDocument();
    _resetBoxPasswordState();
    state.packages = core("10.0.54");
    const checkImpl = vi.fn(() => Promise.resolve(false));
    renderNotice(checkImpl);
    await act(async () => {});
    expect(checkImpl).not.toHaveBeenCalled();
    expect(screen.queryByText("Change your AVADO's password")).not.toBeInTheDocument();
  });

  it("goes away once the password is changed on the other page", async () => {
    renderNotice(() => Promise.resolve(false));
    expect(await screen.findByText("Change your AVADO's password")).toBeInTheDocument();
    await act(() => changeBoxPassword({ currentPassword: "avado", newPassword: "my own secret 1" }, () => Promise.resolve(null)));
    expect(screen.queryByText("Change your AVADO's password")).not.toBeInTheDocument();
  });
});
