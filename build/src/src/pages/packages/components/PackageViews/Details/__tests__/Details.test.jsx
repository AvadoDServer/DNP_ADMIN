import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Details, { shortOrigin } from "pages/packages/components/PackageViews/Details";

const { copyMock, toastMock } = vi.hoisted(() => ({ copyMock: vi.fn(), toastMock: vi.fn() }));
vi.mock("utils/copyText", () => ({ default: copyMock }));
vi.mock("react-toastify", () => ({ toast: toastMock }));
vi.mock("pages/packages/components/PackageViews/Details/Links", () => ({ default: () => null }));
vi.mock("pages/packages/components/PackageViews/Details/Ports", () => ({ default: () => null }));
vi.mock("pages/packages/components/PackageViews/Details/Vols", () => ({ default: () => null }));

const HASH = "QmSvRFFRLQ8mawKdyLmCjB3vrGgFX8LYAzq3W4oSfuLxZ9";

describe("shortOrigin", () => {
  it("shortens an IPFS hash to its first and last four characters", () => {
    expect(shortOrigin(HASH)).toBe("QmSv…LxZ9");
    expect(shortOrigin(`/ipfs/${HASH}`)).toBe("QmSv…LxZ9");
  });
  it("leaves short values alone", () => {
    expect(shortOrigin("abc")).toBe("abc");
    expect(shortOrigin(undefined)).toBe("");
  });
});

describe("package Details version", () => {
  beforeEach(() => {
    copyMock.mockReset();
    toastMock.mockReset();
  });

  it("shows the version and a short hash with a copy button that copies all of it", async () => {
    copyMock.mockResolvedValue();
    render(<Details dnp={{ state: "running", manifest: { version: "0.1.2", origin: `/ipfs/${HASH}` } }} />);
    expect(screen.getByText("0.1.2")).toBeInTheDocument();
    expect(screen.getByText("QmSv…LxZ9")).toHaveAttribute("title", `/ipfs/${HASH}`);
    expect(screen.queryByText(new RegExp(HASH))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy the full IPFS hash" }));
    expect(copyMock).toHaveBeenCalledWith(`/ipfs/${HASH}`);
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith("Copied"));
  });

  it("says so when the browser does not copy", async () => {
    copyMock.mockRejectedValue(Error("no"));
    render(<Details dnp={{ state: "running", manifest: { version: "0.1.2", origin: HASH } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy the full IPFS hash" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith("Could not copy"));
  });
  it("shows no hash or copy button for a package without one", () => {
    render(<Details dnp={{ state: "running", manifest: { version: "1.0.0" } }} />);
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy/ })).toBeNull();
  });
});
