import React from "react";
import { render, screen } from "@testing-library/react";
import { storageRows, SystemStorage } from "pages/system/components/SystemStorage";

describe("SystemStorage disk meter", () => {
  const renderDisk = disk =>
    render(<SystemStorage dnpInstalled={[]} dappnodeStats={{ disk }} runSignedCmd={() => {}} />);

  it("parses the percentage the same way as Home (parsePercent), tolerating a '%' suffix", () => {
    renderDisk("42.4%");
    expect(screen.getByText("42% used")).toBeInTheDocument();
  });

  it("is at the accent/warning threshold right at 80%, not just above it", () => {
    const { container } = renderDisk("80%");
    expect(container.querySelector(".bg-warning")).toBeInTheDocument();
    expect(container.querySelector(".bg-danger")).not.toBeInTheDocument();
  });

  it("is at the warning/danger threshold right at 90%, not just above it", () => {
    const { container } = renderDisk("90%");
    expect(container.querySelector(".bg-danger")).toBeInTheDocument();
  });

  it("is accent (not warning) below 80%", () => {
    const { container } = renderDisk("79%");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
    expect(container.querySelector(".bg-warning")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-danger")).not.toBeInTheDocument();
  });
});

describe("storageRows", () => {
  it("sorts apps by disk use and computes shares", () => {
    const rows = storageRows([
      { name: "a", volumes: [{ size: 100 }] },
      { name: "b", volumes: [{ size: 300 }, { size: 100 }] },
      { name: "c", volumes: [] },
    ]);
    expect(rows.map(r => r.pkg.name)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ size: 400, share: 0.8 });
  });

  it("leaves out apps using no disk space and returns [] when there are none", () => {
    expect(storageRows([{ name: "empty", volumes: [] }])).toEqual([]);
    expect(storageRows([])).toEqual([]);
    expect(storageRows()).toEqual([]);
  });
});
