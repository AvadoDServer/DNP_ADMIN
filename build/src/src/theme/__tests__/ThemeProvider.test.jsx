import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ThemeProvider, { useTheme } from "../ThemeProvider";

/** A minimal, spec-compliant MediaQueryList mock with a live `dispatch`. */
function createMatchMediaMock(initialMatches) {
  let listeners = [];
  const mql = {
    matches: initialMatches,
    media: "(prefers-color-scheme: light)",
    addEventListener: (_event, cb) => listeners.push(cb),
    removeEventListener: (_event, cb) => {
      listeners = listeners.filter((l) => l !== cb);
    },
    addListener: (cb) => listeners.push(cb), // legacy Safari API
    removeListener: (cb) => {
      listeners = listeners.filter((l) => l !== cb);
    },
    dispatch(nextMatches) {
      mql.matches = nextMatches;
      listeners.slice().forEach((cb) => cb({ matches: nextMatches }));
    },
  };
  return mql;
}

function Probe() {
  const { theme, preference, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="preference">{preference}</span>
      <button onClick={() => setPreference("light")}>set-light</button>
      <button onClick={() => setPreference("dark")}>set-dark</button>
      <button onClick={() => setPreference("system")}>set-system</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );

describe("ThemeProvider", () => {
  let mql;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    mql = createMatchMediaMock(true); // OS prefers light
    window.matchMedia = () => mql;
  });

  it("defaults to preference 'system' and follows matchMedia", () => {
    renderProvider();
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("defaults to dark when the OS prefers dark", () => {
    mql.matches = false;
    renderProvider();
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setPreference('light') persists and sets data-theme=\"light\"", () => {
    renderProvider();
    act(() => fireEvent.click(screen.getByText("set-light")));

    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.getByTestId("preference")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("setPreference('dark') persists and sets data-theme=\"dark\"", () => {
    renderProvider();
    act(() => fireEvent.click(screen.getByText("set-dark")));

    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setPreference('system') removes the stored key and follows a mocked matchMedia change", () => {
    renderProvider();

    // Start from an explicit choice so the localStorage key exists.
    act(() => fireEvent.click(screen.getByText("set-dark")));
    expect(localStorage.getItem("theme")).toBe("dark");

    act(() => fireEvent.click(screen.getByText("set-system")));
    expect(localStorage.getItem("theme")).toBeNull();
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    // matchMedia currently reports "light" (mql.matches === true).
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // The OS switches to dark — the provider must follow it live.
    act(() => mql.dispatch(false));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // And back again.
    act(() => mql.dispatch(true));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("does not follow OS changes once an explicit preference is set", () => {
    renderProvider();
    act(() => fireEvent.click(screen.getByText("set-dark")));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");

    act(() => mql.dispatch(true)); // OS now prefers light — must be ignored
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
