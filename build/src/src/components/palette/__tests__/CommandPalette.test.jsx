import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import CommandPalette from "components/palette/CommandPalette";

vi.mock("health/HealthProvider", () => ({ useHealth: () => ({ storePackages: [] }) }));

// commands.js has its own dedicated unit tests (commands.test.js). Here we
// stub it with a small, deterministic fixture so CommandPalette's own
// behaviour (open/close, filtering, keyboard nav) can be asserted precisely.
const FIXED_COMMANDS = [
  { id: "page:dashboard", group: "Pages", label: "Home", keywords: "", to: "/dashboard" },
  { id: "page:help", group: "Pages", label: "Help", keywords: "", to: "/help" },
  { id: "app:nimbus", group: "Your apps", label: "Nimbus Consensus Client", keywords: "nimbus", to: "/packages/nimbus.avado.dnp.dappnode.eth" },
];
vi.mock("components/palette/commands", () => ({
  buildCommands: () => FIXED_COMMANDS,
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

    expect(screen.getAllByRole("option")).toHaveLength(3);

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
});
