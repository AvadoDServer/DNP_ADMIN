import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import SideBar, { toggleSideNav } from "../SideBar";

const renderSideBar = (history) =>
  render(
    <Provider store={createStore(() => ({ dnpInstalled: [] }))}>
      <Router history={history}>
        <SideBar />
      </Router>
    </Provider>
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
