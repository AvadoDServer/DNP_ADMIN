import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "../NotFound";

const renderAt = () => render(<MemoryRouter><NotFound /></MemoryRouter>);

describe("NotFound", () => {
  it("shows the not-found heading and a way back to Home and Help", () => {
    renderAt();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Get help" })).toHaveAttribute("href", "/help");
  });
});
