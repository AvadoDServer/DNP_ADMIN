import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { verdictSentence, VerdictView } from "pages/dashboard/components/VerdictPanel";

// A stand-in that still honours hideTitle/showWhy so the "no repeat"
// behaviour is actually observable, without pulling in FindingRow's real
// dependencies (react-redux dispatch, health/fixActions, ...).
vi.mock("components/health/FindingRow", () => ({
  default: ({ finding, hideTitle, showWhy }) => (
    <li>
      {!hideTitle && finding.title}
      {showWhy && finding.why}
    </li>
  ),
}));

const f = (id, severity) => ({ id, severity, topic: "sync", title: `title ${id}`, why: `why ${id}` });

describe("verdictSentence", () => {
  it("uses the worst finding's title, or the healthy sentence", () => {
    expect(verdictSentence({ level: "critical" }, [f("a", "critical")])).toBe("title a");
    expect(verdictSentence({ level: "ok" }, [])).toBe("All good. Your AVADO is healthy.");
  });
});

describe("VerdictView", () => {
  it("doesn't repeat the worst finding: its why sits under the headline, not as its own row", () => {
    const findings = ["a", "b"].map(id => f(id, "critical"));
    render(<MemoryRouter><VerdictView verdict={{ level: "critical", label: "Action required" }} findings={findings} checkedAt={new Date(0)} onRefresh={() => {}} /></MemoryRouter>);
    // Headline is finding "a"'s title (verdictSentence) — appears exactly once.
    expect(screen.getByRole("heading", { name: "title a" })).toBeInTheDocument();
    expect(screen.getAllByText("title a")).toHaveLength(1);
    // Its `why` shows directly under the headline, uncollapsed.
    expect(screen.getByText("why a")).toBeInTheDocument();
    // The row list covers only the remaining findings.
    expect(screen.getByText("title b")).toBeInTheDocument();
  });

  it("shows at most 5 of the remaining findings (excluding the headline) with a show-all toggle", () => {
    const findings = ["a", "b", "c", "d", "e", "f", "g"].map(id => f(id, "warning"));
    render(<MemoryRouter><VerdictView verdict={{ level: "warning", label: "Needs attention" }} findings={findings} checkedAt={new Date(0)} onRefresh={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    // headline = a; remaining = b..g (6), limit 5 shows b..f, hides g.
    expect(screen.getByText("title f")).toBeInTheDocument();
    expect(screen.queryByText("title g")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all 6" }));
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
