import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DevicesLoadError from "../DevicesLoadError";

const at = loadingError =>
  render(
    <MemoryRouter>
      <DevicesLoadError loadingError={loadingError} />
    </MemoryRouter>
  );

describe("DevicesLoadError", () => {
  it("shows a setup prompt when the VPN package is not installed", () => {
    at("the VPN package is not installed on this AVADO");
    expect(screen.getByText("Remote access isn't set up")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Install Remote Connect" })
    ).toBeInTheDocument();
  });

  it("shows the raw message for any other error", () => {
    at("connection to the WAMP router was lost");
    expect(screen.getByText("Could not load devices")).toBeInTheDocument();
    expect(
      screen.getByText("connection to the WAMP router was lost")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Install Remote Connect" })
    ).not.toBeInTheDocument();
  });
});
