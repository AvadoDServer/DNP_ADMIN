import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusPill from "components/ui/StatusPill";
import AppAvatar, { PLACEHOLDER_AVATARS } from "components/ui/AppAvatar";
import Tabs from "components/ui/Tabs";

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
});

describe("Tabs", () => {
  it("marks the active tab and moves with arrow keys", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "logs", label: "Logs" }]} active="overview" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("logs");
  });
});
