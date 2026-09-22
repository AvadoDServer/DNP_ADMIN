import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CategoryHeader, CategoryFilterBanner } from "../StorePresentation";

describe("CategoryHeader", () => {
  it("renders the category title as given by the store, without forcing uppercase", () => {
    render(<CategoryHeader title="ETH Staking" count={3} />);
    const heading = screen.getByRole("heading", { name: "ETH Staking" });
    expect(heading.textContent).toBe("ETH Staking");
    expect(heading).not.toHaveClass("uppercase");
    expect(heading).not.toHaveClass("tracking-wider");
  });
});

describe("CategoryFilterBanner", () => {
  const category = { tag: "ethstaking", description: "ETH Staking", weight: 1 };

  it('shows "Showing <description>" and a Show all link back to the given path', () => {
    const { container } = render(
      <MemoryRouter>
        <CategoryFilterBanner category={category} onShowAllTo="/installer" />
      </MemoryRouter>
    );
    expect(container.textContent).toContain("Showing");
    expect(container.textContent).toContain("ETH Staking");
    const link = screen.getByRole("link", { name: "Show all" });
    expect(link).toHaveAttribute("href", "/installer");
  });

  it("renders nothing when there is no highlighted category (unknown/missing ?category=)", () => {
    const { container } = render(
      <MemoryRouter>
        <CategoryFilterBanner category={undefined} onShowAllTo="/installer" />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
