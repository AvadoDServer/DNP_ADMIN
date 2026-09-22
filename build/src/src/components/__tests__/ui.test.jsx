import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import StatusPill from "components/ui/StatusPill";
import AppAvatar, { PLACEHOLDER_AVATARS } from "components/ui/AppAvatar";
import Tabs from "components/ui/Tabs";
import Button from "components/ui/Button";

describe("StatusPill", () => {
  it("renders the label with the tone", () => {
    render(<StatusPill status={{ label: "Running", tone: "success" }} />);
    expect(screen.getByText("Running")).toHaveAttribute("data-tone", "success");
  });
});

describe("AppAvatar fallback", () => {
  it("renders a monogram for placeholder avatars and missing manifests", () => {
    const { rerender } = render(<AppAvatar pkg={{ name: "node-exporter.avado.dappnode.eth", manifest: { title: "Node Exporter", avatar: PLACEHOLDER_AVATARS[0] } }} />);
    expect(screen.getByText("NE")).toBeInTheDocument();
    rerender(<AppAvatar pkg={{ name: "custom.public.dappnode.eth" }} />);
    expect(screen.getByText("CU")).toBeInTheDocument();
  });
  it("falls back to the monogram when the image fails", () => {
    const { container } = render(<AppAvatar pkg={{ name: "x.dnp.dappnode.eth", manifest: { title: "Xylo App", avatar: "/ipfs/QmReal" } }} />);
    fireEvent.error(container.querySelector("img"));
    expect(screen.getByText("XA")).toBeInTheDocument();
  });
  it("uses text-fg (not a role-coloured text class) for every monogram, for WCAG AA contrast on the tinted background", () => {
    // nimbus.avado.dnp.dappnode.eth is a consensus client (role "consensus" -> bg-brand/15 tint)
    const { rerender } = render(<AppAvatar pkg={{ name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus" } }} />);
    expect(screen.getByText("NI")).toHaveClass("text-fg");
    expect(screen.getByText("NI")).not.toHaveClass("text-brand");

    // unknown role falls back to the neutral tint
    rerender(<AppAvatar pkg={{ name: "custom.public.dappnode.eth" }} />);
    expect(screen.getByText("CU")).toHaveClass("text-fg");
    expect(screen.getByText("CU")).not.toHaveClass("text-fg-muted");
  });
});

describe("Tabs", () => {
  it("marks the active tab and moves with arrow keys", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "logs", label: "Logs" }]} active="overview" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("logs");
  });

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "logs", label: "Logs" },
    { id: "settings", label: "Settings" },
  ];

  function StatefulTabs({ initial }) {
    const [active, setActive] = React.useState(initial);
    return <Tabs tabs={TABS} active={active} onChange={setActive} />;
  }

  it("moves DOM focus (roving tabindex) to the newly selected tab on ArrowRight", () => {
    render(<StatefulTabs initial="overview" />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    const logs = screen.getByRole("tab", { name: "Logs" });
    expect(document.activeElement).toBe(logs);
    expect(logs).toHaveAttribute("aria-selected", "true");
    expect(logs).toHaveAttribute("tabIndex", "0");
    expect(overview).toHaveAttribute("tabIndex", "-1");
  });

  it("moves focus with Home and End", () => {
    render(<StatefulTabs initial="logs" />);
    const logs = screen.getByRole("tab", { name: "Logs" });
    fireEvent.keyDown(logs, { key: "End" });
    const settings = screen.getByRole("tab", { name: "Settings" });
    expect(document.activeElement).toBe(settings);
    expect(settings).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(settings, { key: "Home" });
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(document.activeElement).toBe(overview);
    expect(overview).toHaveAttribute("aria-selected", "true");
  });
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

describe("Button as a non-button element, disabled", () => {
  it("is aria-disabled, out of tab order, and clicking it does not navigate", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Button as={Link} to="/x" disabled>
          Go
        </Button>
        <LocationProbe />
      </MemoryRouter>
    );
    const link = screen.getByText("Go").closest("a");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabIndex", "-1");
    expect(link).not.toHaveAttribute("disabled");

    fireEvent.click(link);
    expect(screen.getByTestId("pathname").textContent).toBe("/");
  });

  it("a real button keeps the native disabled attribute and no aria-disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled");
  });
});
