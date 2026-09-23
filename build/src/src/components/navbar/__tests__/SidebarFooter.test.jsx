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

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(setPreference).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Match computer" }));
    expect(setPreference).toHaveBeenCalledWith("system");

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(setPreference).toHaveBeenCalledWith("light");
  });

  it("marks the current preference as checked in the theme radiogroup", () => {
    renderFooter({}); // mocked useTheme() above returns preference: "light"
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "false");
  });

  it("mode switch calls setMode with the chosen value", () => {
    renderFooter({});
    fireEvent.click(screen.getByRole("radio", { name: "Advanced" }));
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

  it("opens the identity popover with node id / IP details on the box-name button, and closes on outside click", () => {
    renderFooter({ name: "My AVADO", nodeid: "Qm123", ip: "1.2.3.4", internalip: "192.168.1.5" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-identity-button"));
    expect(screen.getByRole("dialog", { name: "AVADO identity" })).toBeInTheDocument();
    expect(screen.getByText("Qm123")).toBeInTheDocument();
    expect(screen.getByText("1.2.3.4")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.5")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the identity popover on Escape", () => {
    renderFooter({ nodeid: "Qm123" });
    fireEvent.click(screen.getByTestId("sidebar-identity-button"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
