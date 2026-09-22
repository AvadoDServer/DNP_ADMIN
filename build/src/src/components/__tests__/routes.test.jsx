import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { AppRoutes } from "../../AppRoutes";

const pages = {
  dashboard: { rootPath: "/dashboard", RootComponent: () => <p>home page</p> },
  help: { rootPath: "/help", RootComponent: () => <p>help page</p> },
  packages: {
    rootPath: "/packages",
    RootComponent: () => (
      <Route path="/packages/:id" render={({ match, location }) => <p>app {match.params.id}{location.search}</p>} />
    ),
  },
  system: {
    rootPath: "/system",
    RootComponent: ({ location }) => <p>system page{location.search}</p>,
  },
};

const at = path => render(<MemoryRouter initialEntries={[path]}><AppRoutes pages={pages} /></MemoryRouter>);

describe("routes", () => {
  it.each([
    ["/", "home page"],
    ["/troubleshoot", "help page"],
    ["/support", "help page"],
    ["/Packages/nimbus.avado.dnp.dappnode.eth", "app nimbus.avado.dnp.dappnode.eth"],
    ["/activity", "system page"],
  ])("%s lands on %s", (path, text) => {
    at(path);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows a not-found page for unknown paths", () => {
    at("/nope");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("keeps the query string when redirecting a legacy capitalized /System path", () => {
    at("/System/updates?tab=core");
    expect(screen.getByText("system page?tab=core")).toBeInTheDocument();
  });

  it("keeps the query string when redirecting a legacy capitalized /Packages path", () => {
    at("/Packages/nimbus.avado.dnp.dappnode.eth?tab=logs");
    expect(screen.getByText("app nimbus.avado.dnp.dappnode.eth?tab=logs")).toBeInTheDocument();
  });
});
