import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import SidebarFooter from "../SidebarFooter";

const setPreference = vi.fn();
const setMode = vi.fn();

vi.mock("theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", preference: "light", setPreference })
}));

vi.mock("settings/ModeProvider", () => ({
  useMode: () => ({ mode: "simple", setMode })
}));

const renderFooter = (params = {}) =>
  render(
    <Provider store={createStore(() => ({ dappnodeStatus: { params } }))}>
      <SidebarFooter />
    </Provider>
  );

beforeEach(() => {
  setPreference.mockClear();
  setMode.mockClear();
  delete process.env.REACT_APP_VERSION;
});

describe("SidebarFooter", () => {
  it("shows the box name from getDappnodeParams()", () => {
    renderFooter({ name: "Alice's AVADO" });
    expect(screen.getByText("Alice's AVADO")).toBeInTheDocument();
  });

  it('falls back to "My AVADO" when no name is set', () => {
    renderFooter({});
    expect(screen.getByText("My AVADO")).toBeInTheDocument();
  });

  it("theme switch calls setPreference with the chosen value", () => {
    renderFooter({});

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(setPreference).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByRole("button", { name: "Match computer" }));
    expect(setPreference).toHaveBeenCalledWith("system");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(setPreference).toHaveBeenCalledWith("light");
  });

  it("marks the current preference as pressed in the theme toggle-button group", () => {
    renderFooter({}); // mocked useTheme() above returns preference: "light"
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  });

  it("theme and mode switches are labelled toggle-button groups, not radiogroups", () => {
    renderFooter({});
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Mode" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("mode switch calls setMode with the chosen value", () => {
    renderFooter({});
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(setMode).toHaveBeenCalledWith("advanced");
  });

  it("hides the version line when REACT_APP_VERSION is unknown", () => {
    renderFooter({});
    expect(screen.queryByText(/^Version/)).not.toBeInTheDocument();
  });

  it("shows the version line when REACT_APP_VERSION is set", () => {
    process.env.REACT_APP_VERSION = "10.0.53";
    renderFooter({});
    expect(screen.getByText("Version 10.0.53")).toBeInTheDocument();
  });

  it("opens the identity popover with node id / IP details on the box-name button, moves focus into it, and closes on outside click", () => {
    renderFooter({ name: "My AVADO", nodeid: "Qm123", ip: "1.2.3.4", internalip: "192.168.1.5" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-identity-button"));
    const dialog = screen.getByRole("dialog", { name: "AVADO identity" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveFocus();
    expect(screen.getByText("Qm123")).toBeInTheDocument();
    expect(screen.getByText("1.2.3.4")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.5")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the identity popover on Escape and returns focus to the trigger button", () => {
    renderFooter({ nodeid: "Qm123" });
    const trigger = screen.getByTestId("sidebar-identity-button");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("returns focus to the trigger button when closed by an outside click", () => {
    renderFooter({ nodeid: "Qm123" });
    const trigger = screen.getByTestId("sidebar-identity-button");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
