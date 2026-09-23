import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { ModeProvider } from "settings/ModeProvider";
import { ThemeProvider } from "theme/ThemeProvider";
import SideBar, { toggleSideNav } from "../SideBar";

const baseState = { dnpInstalled: [], dappnodeStatus: { params: {} } };

const renderSideBar = (history, state = baseState) =>
  render(
    <ThemeProvider>
      <Provider store={createStore(() => state)}>
        <Router history={history}>
          <ModeProvider>
            <SideBar />
          </ModeProvider>
        </Router>
      </Provider>
    </ThemeProvider>
  );

// Below 1024 px the sidebar is an off-canvas drawer, opened by the topbar's
// burger (`toggleSideNav`, dispatched here directly as TopBar.jsx does) and
// closed by tapping its overlay or navigating — see layout.css / SideBar.jsx.
describe("SideBar (off-canvas drawer)", () => {
  it("opens on toggleSideNav and closes again on route change", () => {
    const history = createMemoryHistory({ initialEntries: ["/dashboard"] });
    renderSideBar(history);

    expect(document.getElementById("sidebar")).toHaveClass("collapsed");

    act(() => {
      toggleSideNav();
    });
    expect(document.getElementById("sidebar")).not.toHaveClass("collapsed");
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();

    act(() => {
      history.push("/installer");
    });
    expect(document.getElementById("sidebar")).toHaveClass("collapsed");
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });

  it("closes when the overlay is tapped", () => {
    const history = createMemoryHistory({ initialEntries: ["/dashboard"] });
    renderSideBar(history);

    act(() => {
      toggleSideNav();
    });
    fireEvent.click(screen.getByTestId("sidebar-overlay"));

    expect(document.getElementById("sidebar")).toHaveClass("collapsed");
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });
});

// Simple/Advanced mode (spec §5): SideBar filters its items through
// settings/visibility.js#visibleNavItems; the mode switch itself lives in
// the footer (SidebarFooter.jsx), rendered inside SideBar.
describe("SideBar (Simple/Advanced items)", () => {
  it("shows simple items by default (no System, Priority, Remote Connect or Connect (VPN))", () => {
    const history = createMemoryHistory({ initialEntries: ["/dashboard"] });
    renderSideBar(history);

    expect(screen.getByRole("link", { name: /^Home$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^DappStore$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^My DApps$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Staking setup$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Help$/ })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /^System$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Priority$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Remote Connect$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Connect \(VPN\)$/ })).not.toBeInTheDocument();
  });

  it("switching to Advanced (via the footer switch) shows System", () => {
    const history = createMemoryHistory({ initialEntries: ["/dashboard"] });
    renderSideBar(history);

    expect(screen.queryByRole("link", { name: /^System$/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Advanced" }));

    expect(screen.getByRole("link", { name: /^System$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Priority$/ })).toBeInTheDocument();
  });
});
