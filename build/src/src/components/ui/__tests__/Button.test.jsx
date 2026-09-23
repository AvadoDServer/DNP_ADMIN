import React from "react";
import { render, screen } from "@testing-library/react";
import Button from "../Button";

describe("Button", () => {
  it("carries the focus-ring class regardless of variant", () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
      </>
    );
    for (const name of ["Primary", "Secondary", "Outline", "Ghost", "Danger", "Success"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("focus-visible:shadow-focus");
    }
  });

  it("pills primary and secondary by default; ghost stays unpilled", () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
      </>
    );
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("rounded-full");
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass("rounded-full");
    expect(screen.getByRole("button", { name: "Ghost" })).not.toHaveClass("rounded-full");
  });

  it("the `pill` prop still forces a pill shape on any variant", () => {
    render(
      <Button variant="danger" pill>
        Confirm
      </Button>
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveClass("rounded-full");
  });

  it("defaults to a 44px (h-11) touch target", () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole("button", { name: "Default" })).toHaveClass("h-11");
  });
});
