import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeProvider, useMode } from "settings/ModeProvider";
import AdvancedNote from "../AdvancedNote";

function ModeProbe() {
  const { mode } = useMode();
  return <span data-testid="mode">{mode}</span>;
}

const renderNote = children =>
  render(
    <ModeProvider>
      <ModeProbe />
      <AdvancedNote>{children}</AdvancedNote>
    </ModeProvider>
  );

beforeEach(() => {
  localStorage.clear();
});

describe("AdvancedNote", () => {
  it("shows a default explanation when no children are passed", () => {
    renderNote();
    expect(screen.getByText(/This is an advanced page/)).toBeInTheDocument();
  });

  it("shows custom copy when children are passed", () => {
    renderNote("This is an advanced page. Do the thing.");
    expect(screen.getByText("This is an advanced page. Do the thing.")).toBeInTheDocument();
  });

  it("switches to advanced mode when the button is clicked", () => {
    renderNote();
    expect(screen.getByTestId("mode").textContent).toBe("simple");
    fireEvent.click(screen.getByRole("button", { name: "Switch to advanced mode" }));
    expect(screen.getByTestId("mode").textContent).toBe("advanced");
  });
});
