import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ModeProvider, useMode } from "../ModeProvider";

function Probe() {
  const { mode, isAdvanced, setMode, toggleMode } = useMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="isAdvanced">{String(isAdvanced)}</span>
      <button data-testid="set-advanced" onClick={() => setMode("advanced")}>
        advanced
      </button>
      <button data-testid="set-invalid" onClick={() => setMode("expert")}>
        invalid
      </button>
      <button data-testid="toggle" onClick={toggleMode}>
        toggle
      </button>
    </div>
  );
}

const renderProbe = () => render(<ModeProvider><Probe /></ModeProvider>);

beforeEach(() => {
  localStorage.clear();
});

describe("ModeProvider / useMode", () => {
  it("defaults to simple when nothing is stored", () => {
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("simple");
    expect(screen.getByTestId("isAdvanced").textContent).toBe("false");
  });

  it("persists the chosen mode to localStorage and restores it on remount", () => {
    const { unmount } = renderProbe();
    act(() => {
      fireEvent.click(screen.getByTestId("set-advanced"));
    });
    expect(screen.getByTestId("mode").textContent).toBe("advanced");
    expect(screen.getByTestId("isAdvanced").textContent).toBe("true");
    expect(localStorage.getItem("avado.mode")).toBe("advanced");
    unmount();

    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("advanced");
  });

  it("toggleMode flips between simple and advanced", () => {
    renderProbe();
    act(() => {
      fireEvent.click(screen.getByTestId("toggle"));
    });
    expect(screen.getByTestId("mode").textContent).toBe("advanced");
    act(() => {
      fireEvent.click(screen.getByTestId("toggle"));
    });
    expect(screen.getByTestId("mode").textContent).toBe("simple");
  });

  it("ignores an unrecognised mode value passed to setMode", () => {
    renderProbe();
    act(() => {
      fireEvent.click(screen.getByTestId("set-invalid"));
    });
    expect(screen.getByTestId("mode").textContent).toBe("simple");
  });

  it("falls back to simple when localStorage holds a corrupted/unknown value", () => {
    localStorage.setItem("avado.mode", "{not-a-valid-mode");
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("simple");
  });

  it("falls back to simple when localStorage.getItem throws (private mode / blocked storage)", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderProbe();
    expect(screen.getByTestId("mode").textContent).toBe("simple");
    spy.mockRestore();
  });

  it("setMode swallows a localStorage.setItem failure instead of throwing", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderProbe();
    expect(() => {
      act(() => {
        fireEvent.click(screen.getByTestId("set-advanced"));
      });
    }).not.toThrow();
    expect(screen.getByTestId("mode").textContent).toBe("advanced");
    spy.mockRestore();
  });
});
