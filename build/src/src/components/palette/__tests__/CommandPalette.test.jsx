import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import CommandPalette from "components/palette/CommandPalette";

vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ storePackages: [] }) }));

const { modeState, setModeSpy, setPreferenceSpy, buildCommandsSpy } = vi.hoisted(() => ({
  modeState: { mode: "simple" },
  setModeSpy: vi.fn(),
  setPreferenceSpy: vi.fn(),
  buildCommandsSpy: vi.fn(),
}));
// Mode/theme are their own systems with their own tests
// (settings/__tests__/ModeProvider.test.jsx, theme/__tests__/ThemeProvider.test.jsx);
// stubbed here so the "Switch to ... mode" / "Use ... theme" commands below
// can be asserted against a spy instead of real persisted state.
vi.mock("settings/ModeProvider", () => ({ useMode: () => ({ mode: modeState.mode, setMode: setModeSpy }) }));
vi.mock("theme/ThemeProvider", () => ({ useTheme: () => ({ setPreference: setPreferenceSpy }) }));

// commands.js has its own dedicated unit tests (commands.test.js). Here we
// stub it with a small, deterministic fixture so CommandPalette's own
// behaviour (open/close, filtering, keyboard nav) can be asserted precisely.
// The spy also lets a couple of tests below assert *what* CommandPalette
// passes into buildCommands (mode, nav).
const FIXED_COMMANDS = [
  { id: "page:dashboard", group: "Pages", label: "Home", keywords: "", to: "/dashboard" },
  { id: "page:help", group: "Pages", label: "Help", keywords: "", to: "/help" },
  { id: "app:nimbus", group: "Your apps", label: "Nimbus Consensus Client", keywords: "nimbus", to: "/packages/nimbus.avado.dnp.dappnode.eth" },
  { id: "mode:advanced", group: "Settings", label: "Switch to advanced mode", keywords: "", action: { type: "setMode", value: "advanced" } },
  { id: "theme:dark", group: "Settings", label: "Use dark theme", keywords: "", action: { type: "setTheme", value: "dark" } },
];
vi.mock("components/palette/commands", () => ({
  buildCommands: (...args) => {
    buildCommandsSpy(...args);
    return FIXED_COMMANDS;
  },
  searchCommands: (commands, query) => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(q));
  },
}));

/** Renders the current router pathname so navigation can be asserted on. */
function LocationProbe() {
  const location = useLocation();
  return <p>path:{location.pathname}</p>;
}

function renderPalette() {
  const store = createStore(() => ({ dnpInstalled: [] }));
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <button type="button">opener</button>
        <LocationProbe />
        <CommandPalette />
      </MemoryRouter>
    </Provider>
  );
}

const ctrlK = () => fireEvent.keyDown(document, { key: "k", ctrlKey: true });

beforeEach(() => {
  modeState.mode = "simple";
  setModeSpy.mockClear();
  setPreferenceSpy.mockClear();
  buildCommandsSpy.mockClear();
});

describe("CommandPalette", () => {
  it("renders nothing until opened, then opens on Ctrl-K", () => {
    renderPalette();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    ctrlK();

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("typing filters the visible options", () => {
    renderPalette();
    ctrlK();

    expect(screen.getAllByRole("option")).toHaveLength(FIXED_COMMANDS.length);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "nimbus" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Nimbus Consensus Client");
  });

  it("ArrowDown then Enter navigates to the highlighted command", () => {
    renderPalette();
    ctrlK();

    const input = screen.getByRole("combobox");
    // Order for an empty query is [Home, Help, Nimbus]; ArrowDown once moves
    // the highlight from Home (index 0) to Help (index 1).
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("path:/help")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("Ctrl+Shift+K does not open the palette, and the event is left unprevented (Firefox's web console)", () => {
    renderPalette();

    // fireEvent returns the DOM dispatchEvent() result: false only if some
    // handler called preventDefault() on this (cancelable) keydown.
    const notPrevented = fireEvent.keyDown(document, { key: "K", ctrlKey: true, shiftKey: true });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(notPrevented).toBe(true);
  });

  it("group headings render in sentence case, not visually uppercased", () => {
    renderPalette();
    ctrlK();

    const heading = screen.getByText("Pages");
    expect(heading).toBeInTheDocument();
    expect(heading.className).not.toMatch(/\buppercase\b/);
  });

  it("Escape closes the palette and returns focus to the opener", () => {
    renderPalette();
    const opener = screen.getByText("opener");
    opener.focus();

    ctrlK();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("passes the current mode and installed package names through to buildCommands", () => {
    modeState.mode = "advanced";
    renderPalette();
    ctrlK();

    expect(buildCommandsSpy).toHaveBeenCalled();
    const args = buildCommandsSpy.mock.calls[buildCommandsSpy.mock.calls.length - 1][0];
    expect(args.mode).toBe("advanced");
    expect(Array.isArray(args.nav)).toBe(true);
    expect(Array.isArray(args.advancedNav)).toBe(true);
  });

  it("running a 'Switch to advanced mode' command calls setMode and closes the palette", () => {
    renderPalette();
    ctrlK();

    fireEvent.click(screen.getByText("Switch to advanced mode"));

    expect(setModeSpy).toHaveBeenCalledWith("advanced");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("running a 'Use dark theme' command calls setPreference and closes the palette", () => {
    renderPalette();
    ctrlK();

    fireEvent.click(screen.getByText("Use dark theme"));

    expect(setPreferenceSpy).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
