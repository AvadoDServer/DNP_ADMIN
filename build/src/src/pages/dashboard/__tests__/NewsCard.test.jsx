import { render, screen, fireEvent, act } from "@testing-library/react";
import NewsCard from "pages/dashboard/components/NewsCard";
import { parseNews } from "pages/dashboard/news";

const raw = {
  id: "disk-kit-2026",
  title: "A bigger disk for your AVADO",
  body: "The 4 TB kit is back in stock.",
  link: { label: "See the kit", url: "https://www.ava.do/shop/4tb-disk-upgrade/" },
};
const smallDisk = { cpuName: "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz", diskTotal: "1.82 TB" };

// Renders the card with `loadImpl` standing in for the fetch (what newsApi's
// loadNews resolves to: a checked item or null), and lets it settle.
async function renderCard(news, props = {}) {
  const loadImpl = vi.fn(() => Promise.resolve(news));
  let view;
  await act(async () => {
    view = render(<NewsCard stats={{}} loadImpl={loadImpl} {...props} />);
  });
  return { ...view, loadImpl };
}

beforeEach(() => localStorage.clear());

describe("NewsCard", () => {
  it("shows the item with its label, link and the newsletter line", async () => {
    await renderCard(parseNews(raw));
    expect(screen.getByRole("region", { name: "News from AVADO" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: raw.title })).toBeInTheDocument();
    expect(screen.getByText(raw.body)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "See the kit" });
    expect(link).toHaveAttribute("href", raw.link.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const newsletter = screen.getByRole("link", { name: "Get important AVADO news by email" });
    expect(newsletter).toHaveAttribute("href", "https://www.ava.do/#newsletter-email");
    expect(newsletter).toHaveAttribute("target", "_blank");
    expect(newsletter).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nothing while the item is loading", () => {
    const { container } = render(<NewsCard stats={{}} loadImpl={() => new Promise(() => {})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no item or the fetch fails", async () => {
    expect((await renderCard(null)).container).toBeEmptyDOMElement();
    const failing = vi.fn(() => Promise.reject(Error("Network Error")));
    let view;
    await act(async () => {
      view = render(<NewsCard stats={{}} loadImpl={failing} />);
    });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("renders nothing for an item that fails the checks", async () => {
    // parseNews turns these into null, which is what the card is handed.
    for (const bad of [{ ...raw, title: "" }, { ...raw, audience: "someone-else" }, "<html>"]) {
      const { container, unmount } = await renderCard(parseNews(bad));
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("shows the item without a link when the link is not on ava.do", async () => {
    await renderCard(parseNews({ ...raw, link: { label: "Click here", url: "https://evil.example/" } }));
    expect(screen.getByRole("heading", { name: raw.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Click here" })).not.toBeInTheDocument();
  });

  it("shows markup in the title and body as plain text", async () => {
    const { container } = await renderCard(parseNews({ ...raw, title: "<b>Bold</b>", body: '<img src=x onerror="alert(1)">' }));
    expect(screen.getByText("<b>Bold</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it('"Got it" hides the item for good, and a new item still shows', async () => {
    const first = await renderCard(parseNews(raw));
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(first.container).toBeEmptyDOMElement();
    expect(JSON.parse(localStorage.getItem("avado.dismissedNews"))).toEqual([raw.id]);
    first.unmount();

    // After a reload the same item stays away...
    const again = await renderCard(parseNews(raw));
    expect(again.container).toBeEmptyDOMElement();
    again.unmount();

    // ...and the next one appears.
    await renderCard(parseNews({ ...raw, id: "next-item", title: "Something new" }));
    expect(screen.getByRole("heading", { name: "Something new" })).toBeInTheDocument();
  });

  it("hides an item past its date", async () => {
    const { container } = await renderCard(parseNews({ ...raw, until: "2020-01-01" }));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a "small-disk" item only on the box it is meant for', async () => {
    const news = parseNews({ ...raw, audience: "small-disk" });
    const other = await renderCard(news, { stats: { cpuName: "AMD Ryzen 9 6900HX", diskTotal: "3.64 TB" } });
    expect(other.container).toBeEmptyDOMElement();
    other.unmount();
    await renderCard(news, { stats: smallDisk });
    expect(screen.getByRole("heading", { name: raw.title })).toBeInTheDocument();
  });
});
