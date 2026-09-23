import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { verdictSentence, VerdictView } from "pages/dashboard/components/VerdictPanel";

// mountLog records the finding id every time a *new* FindingRow instance is
// created (a fresh call to the useState lazy initializer, which only ever
// runs once per mounted instance) — used to prove the headline row remounts
// instead of being reused when the headline finding's id changes.
const { mountLog } = vi.hoisted(() => ({ mountLog: [] }));

// A stand-in that still honours hideTitle/showWhy so the "no repeat"
// behaviour is actually observable, without pulling in FindingRow's real
// dependencies (react-redux dispatch, health/fixActions, ...).
function FindingRowStub({ finding, hideTitle, showWhy }) {
  React.useState(() => {
    mountLog.push(finding.id);
    return null;
  });
  return (
    <li>
      {!hideTitle && finding.title}
      {showWhy && finding.why}
    </li>
  );
}
vi.mock("components/health/FindingRow", () => ({ default: FindingRowStub }));

beforeEach(() => {
  mountLog.length = 0;
});

const f = (id, severity) => ({ id, severity, topic: "sync", title: `title ${id}`, why: `why ${id}` });

describe("verdictSentence", () => {
  it("uses the worst finding's title, or the healthy sentence", () => {
    expect(verdictSentence({ level: "critical" }, [f("a", "critical")])).toBe("title a");
    expect(verdictSentence({ level: "ok" }, [])).toBe("Your AVADO is healthy.");
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
    expect(screen.getByText(/12 other checks passed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check again/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/help");
  });

  it("shows the checks-passed footer even when unhealthy (mockup: '20 other checks passed. Checked at 00:25.')", () => {
    const findings = [f("a", "critical")];
    render(
      <MemoryRouter>
        <VerdictView
          verdict={{ level: "critical", label: "Action required" }}
          findings={findings}
          checkedAt={new Date(0)}
          onRefresh={() => {}}
          checksPassed={20}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/20 other checks passed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check again/ })).toBeInTheDocument();
  });

  it("shows a neutral checking state, with no verdict colour and no checks-passed footer, while not ready", () => {
    render(
      <MemoryRouter>
        <VerdictView
          verdict={{ level: "ok", label: "All good" }}
          findings={[]}
          checkedAt={new Date(0)}
          onRefresh={() => {}}
          checksPassed={12}
          ready={false}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Checking your AVADO…" })).toBeInTheDocument();
    expect(screen.queryByText(/checks passed/)).not.toBeInTheDocument();
    expect(screen.queryByText("All good")).not.toBeInTheDocument();
  });

  it("remounts the headline FindingRow when the headline finding changes (key={headline.id}), so per-row state (e.g. FindingRow's own 'Starting…') never carries over to an unrelated finding", () => {
    const renderWith = findings =>
      render(
        <MemoryRouter>
          <VerdictView verdict={{ level: "critical", label: "Action required" }} findings={findings} checkedAt={new Date(0)} onRefresh={() => {}} />
        </MemoryRouter>
      );

    const { rerender } = renderWith([f("a", "critical")]);
    expect(mountLog).toEqual(["a"]);

    rerender(
      <MemoryRouter>
        <VerdictView verdict={{ level: "critical", label: "Action required" }} findings={[f("b", "critical")]} checkedAt={new Date(0)} onRefresh={() => {}} />
      </MemoryRouter>
    );
    // A fresh instance was mounted for "b" — the "a" instance (and any
    // internal state it held) was discarded, not reused with new props.
    expect(mountLog).toEqual(["a", "b"]);
  });
});
