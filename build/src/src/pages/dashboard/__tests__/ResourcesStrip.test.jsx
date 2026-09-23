import React from "react";
import { render, screen } from "@testing-library/react";
import ResourcesStrip from "pages/dashboard/components/ResourcesStrip";

describe("ResourcesStrip (box readings / gauges)", () => {
  it("shows processor, memory and disk percentages", () => {
    render(<ResourcesStrip stats={{ cpu: "6%", memory: "12%", disk: "2%" }} />);
    expect(screen.getByText("Processor")).toBeInTheDocument();
    expect(screen.getByText("6%")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("Disk")).toBeInTheDocument();
    expect(screen.getByText("2%")).toBeInTheDocument();
  });

  it('shows "—", never 0%, when a reading is missing', () => {
    render(<ResourcesStrip stats={{}} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  // Spec §6.0 ranges: processor <80/80-95/>=95, memory <85/85-95/>=95, disk <80/80-90/>=90.
  it.each([
    ["cpu", "79%", "bg-success"],
    ["cpu", "80%", "bg-warning"],
    ["cpu", "95%", "bg-danger"],
  ])("processor %s uses the right tone", async (key, value, expectedClass) => {
    const { container } = render(<ResourcesStrip stats={{ [key]: value }} />);
    const bar = container.querySelector(`.${expectedClass}`);
    expect(bar).toBeInTheDocument();
  });

  it("memory uses its own (85/95) thresholds, distinct from processor's (80/95)", () => {
    const { container } = render(<ResourcesStrip stats={{ memory: "82%" }} />);
    // 82% is below memory's 85% warn threshold, so it must still be ok/success.
    expect(container.querySelector(".bg-success")).toBeInTheDocument();
    expect(container.querySelector(".bg-warning")).not.toBeInTheDocument();
  });

  it("disk uses its own (80/90) thresholds", () => {
    const { container } = render(<ResourcesStrip stats={{ disk: "91%" }} />);
    expect(container.querySelector(".bg-danger")).toBeInTheDocument();
  });
});
