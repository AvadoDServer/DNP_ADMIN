import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdvancedNote from "../AdvancedNote";
import { ModeProvider } from "settings/ModeProvider";

const renderNote = children =>
  render(
    <ModeProvider>
      <AdvancedNote>{children}</AdvancedNote>
    </ModeProvider>
  );

beforeEach(() => {
  localStorage.clear();
});

describe("AdvancedNote", () => {
  it("shows a default message when no children are given", () => {
    renderNote();
    expect(screen.getByText(/advanced page/i)).toBeInTheDocument();
  });

  it("shows the caller's own message when children are given", () => {
    renderNote("Logs is an advanced page.");
    expect(screen.getByText("Logs is an advanced page.")).toBeInTheDocument();
    expect(screen.queryByText(/it's usually hidden/i)).not.toBeInTheDocument();
  });

  it("switches to advanced mode when the button is clicked", () => {
    renderNote();
    expect(localStorage.getItem("avado.mode")).not.toBe("advanced");
    fireEvent.click(screen.getByRole("button", { name: "Switch to advanced mode" }));
    expect(localStorage.getItem("avado.mode")).toBe("advanced");
  });
});
