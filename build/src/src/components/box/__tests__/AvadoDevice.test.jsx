import React from "react";
import { render, screen } from "@testing-library/react";
import AvadoDevice from "components/box/AvadoDevice";

describe("AvadoDevice", () => {
  it.each([
    ["ok", "green", "--success"],
    ["warning", "amber", "--warning"],
    ["critical", "red", "--danger"],
    ["checking", "grey", "--fg-subtle"],
  ])("light=%s uses the %s status light (token %s)", (light, word, token) => {
    const { container } = render(<AvadoDevice light={light} />);
    expect(screen.getByRole("img", { name: `Your AVADO box, status light ${word}` })).toBeInTheDocument();
    const ring = container.querySelector("circle[stroke]");
    expect(ring).toHaveAttribute("stroke", `rgb(var(${token}))`);
  });

  it("falls back to the checking (grey) light for an unknown/missing value", () => {
    render(<AvadoDevice light="not-a-real-status" />);
    expect(screen.getByRole("img", { name: "Your AVADO box, status light grey" })).toBeInTheDocument();
  });

  it("pulses the glow once on mount, respecting reduced motion (motion-safe:)", () => {
    const { container } = render(<AvadoDevice light="critical" />);
    const glow = container.querySelector("circle.motion-safe\\:animate-pulse-once");
    expect(glow).toBeInTheDocument();
  });

  it("gives each instance its own gradient ids, so two devices on one page don't collide", () => {
    render(
      <>
        <AvadoDevice light="ok" />
        <AvadoDevice light="critical" />
      </>
    );
    const gradientIds = Array.from(document.querySelectorAll("radialGradient")).map(el => el.id);
    expect(new Set(gradientIds).size).toBe(gradientIds.length);
  });
});
