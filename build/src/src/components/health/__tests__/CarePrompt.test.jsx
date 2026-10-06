import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CarePrompt from "components/health/CarePrompt";
import { CARE_PACKAGE } from "health/careFindings";

const DAY = 24 * 60 * 60 * 1000;
const TEKU = "teku.avado.dnp.dappnode.eth";
const f = (id, severity) => ({ id, severity, topic: "sync", title: `title ${id}`, why: `why ${id}` });
const stopped = f(`app-stopped:${TEKU}`, "critical");
const packages = [{ name: TEKU, isCore: false, state: "exited" }];
const TEXT = /Want an email the next time something like this happens\? Priority Care watches your AVADO for you\. New subscribers get 14 days free\./;

const renderPrompt = (props = {}) =>
  render(
    <MemoryRouter>
      <CarePrompt findings={[stopped]} packages={packages} {...props} />
    </MemoryRouter>
  );

beforeEach(() => localStorage.clear());

describe("CarePrompt", () => {
  it("offers Priority Care, with a link to its page, while there is a real problem", () => {
    renderPrompt();
    expect(screen.getByText(TEXT)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See Priority Care" })).toHaveAttribute("href", "/priority");
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("shows one line, however many problems there are", () => {
    renderPrompt({ findings: [stopped, f("disk-high", "critical"), f(`head-behind:${TEKU}`, "warning")] });
    expect(screen.getAllByText(TEXT)).toHaveLength(1);
  });

  it("renders nothing without a real problem", () => {
    expect(renderPrompt({ findings: [] }).container).toBeEmptyDOMElement();
    expect(renderPrompt({ findings: [f("updates-available", "warning"), f("no-upnp", "info")] }).container).toBeEmptyDOMElement();
  });

  it("renders nothing when AVADO Care is installed", () => {
    const { container } = renderPrompt({ packages: [...packages, { name: CARE_PACKAGE, isCore: false, state: "running" }] });
    expect(container).toBeEmptyDOMElement();
  });

  it('"Not now" hides it at once and for the next 30 days', () => {
    const before = Date.now();
    const first = renderPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(first.container).toBeEmptyDOMElement();
    const until = Number(localStorage.getItem("avado.carePromptHiddenUntil"));
    expect(until).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(until).toBeLessThanOrEqual(Date.now() + 30 * DAY);
    first.unmount();

    // Still hidden after a reload.
    expect(renderPrompt().container).toBeEmptyDOMElement();
  });

  it("is back once the 30 days are over", () => {
    localStorage.setItem("avado.carePromptHiddenUntil", String(Date.now() - DAY));
    renderPrompt();
    expect(screen.getByText(TEXT)).toBeInTheDocument();
  });
});
