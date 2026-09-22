import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { verdictSentence, VerdictView } from "pages/dashboard/components/VerdictPanel";

vi.mock("components/health/FindingRow", () => ({ default: ({ finding }) => <li>{finding.title}</li> }));

const f = (id, severity) => ({ id, severity, topic: "sync", title: `title ${id}` });

describe("verdictSentence", () => {
  it("uses the worst finding's title, or the healthy sentence", () => {
    expect(verdictSentence({ level: "critical" }, [f("a", "critical")])).toBe("title a");
    expect(verdictSentence({ level: "ok" }, [])).toBe("All good. Your AVADO is healthy.");
  });
});

describe("VerdictView", () => {
  it("shows at most 5 findings with a show-all toggle", () => {
    const findings = ["a", "b", "c", "d", "e", "f", "g"].map(id => f(id, "warning"));
    render(<MemoryRouter><VerdictView verdict={{ level: "warning", label: "Needs attention" }} findings={findings} checkedAt={new Date(0)} onRefresh={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByText("title f")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all 7" }));
    expect(screen.getByText("title g")).toBeInTheDocument();
  });

  it("shows a checks-passed footer with a See all link to Help when healthy", () => {
    render(
      <MemoryRouter>
        <VerdictView
          verdict={{ level: "ok", label: "All good" }}
          findings={[]}
          checkedAt={new Date(0)}
          onRefresh={() => {}}
          checksPassed={12}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/12 checks passed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check again/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/help");
  });
});
