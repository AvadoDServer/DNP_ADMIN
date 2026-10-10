import {
  parseNews,
  safeNewsLink,
  matchesAudience,
  isNewsVisible,
  readDismissedNews,
  dismissNews,
} from "pages/dashboard/news";
import { loadNews, resetNewsCache, NEWS_URL, MOCK_NEWS } from "pages/dashboard/newsApi";

const item = { id: "disk-kit-2026", title: "A bigger disk for your AVADO", body: "The 4 TB kit is back in stock." };
const link = { label: "See the kit", url: "https://www.ava.do/shop/4tb-disk-upgrade/" };
// The box the disk kit fits (health/diskUpgrade.js kitFits), and one it does not.
const smallDisk = { cpuName: "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz", diskTotal: "1.82 TB" };
const bigDisk = { cpuName: "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz", diskTotal: "3.64 TB" };

beforeEach(() => {
  localStorage.clear();
  resetNewsCache();
});

describe("parseNews", () => {
  it("reads the server's double-encoded body: JSON inside a JSON string", () => {
    const expected = { ...item, link: null, until: null, audience: "all" };
    // As axios hands it over (outer layer decoded), fully raw, and already an object.
    expect(parseNews(JSON.stringify(item))).toEqual(expected);
    expect(parseNews(JSON.stringify(JSON.stringify(item)))).toEqual(expected);
    expect(parseNews(item)).toEqual(expected);
  });

  it("gives null for anything that is not an item", () => {
    for (const bad of [undefined, null, "", "not json", "{", 42, true, [], [item], "[]", '"just a string"', {}]) {
      expect(parseNews(bad)).toBeNull();
    }
  });

  it("drops the whole item when id, title or body is missing, the wrong type or too long", () => {
    const wrong = [
      { id: undefined },
      { id: "" },
      { id: 7 },
      { id: "x".repeat(65) },
      { title: undefined },
      { title: "   " },
      { title: ["a"] },
      { title: "x".repeat(81) },
      { body: undefined },
      { body: "" },
      { body: { text: "a" } },
      { body: "x".repeat(401) },
    ];
    for (const patch of wrong) expect(parseNews({ ...item, ...patch })).toBeNull();
  });

  it("accepts fields at their longest", () => {
    const longest = { id: "x".repeat(64), title: "x".repeat(80), body: "x".repeat(400) };
    expect(parseNews(longest)).toMatchObject(longest);
  });

  it("keeps a link to ava.do and drops only the link when it is not safe", () => {
    expect(parseNews({ ...item, link }).link).toEqual(link);
    const noLink = parseNews({ ...item, link: { label: "Click", url: "https://evil.example/" } });
    expect(noLink).toMatchObject(item);
    expect(noLink.link).toBeNull();
  });

  it("reads `until`, and drops the item when it is not an ISO date", () => {
    expect(parseNews({ ...item, until: "2026-11-01T12:00:00Z" }).until).toBe(Date.parse("2026-11-01T12:00:00Z"));
    // A date without a time lasts through that day.
    expect(parseNews({ ...item, until: "2026-11-01" }).until).toBe(Date.parse("2026-11-01T23:59:59.999Z"));
    for (const bad of ["next week", "", "01/11/2026", "2026-13-45", 1793491200000, {}]) {
      expect(parseNews({ ...item, until: bad })).toBeNull();
    }
  });

  it('defaults the audience to "all" and hides an audience it does not know', () => {
    expect(parseNews(item).audience).toBe("all");
    expect(parseNews({ ...item, audience: "small-disk" }).audience).toBe("small-disk");
    for (const bad of ["big-disk", "ALL", "", 1, ["all"]]) expect(parseNews({ ...item, audience: bad })).toBeNull();
  });
});

describe("safeNewsLink", () => {
  it("allows https links on ava.do and its subdomains", () => {
    expect(safeNewsLink({ label: "Shop", url: "https://ava.do/shop" })).toEqual({ label: "Shop", url: "https://ava.do/shop" });
    expect(safeNewsLink({ label: "Docs", url: "https://docs.ava.do/a?b=1#c" }).url).toBe("https://docs.ava.do/a?b=1#c");
    expect(safeNewsLink({ label: "Shop", url: "HTTPS://WWW.AVA.DO/shop" }).url).toBe("https://www.ava.do/shop");
  });

  it("refuses every other address", () => {
    const urls = [
      "http://www.ava.do/",
      "https://ava.do.evil.example/",
      "https://notava.do/",
      "https://evil.example/?https://ava.do",
      "https://ava.do@evil.example/",
      "https://user:pass@ava.do/",
      "javascript:alert(1)",
      "data:text/html,hello",
      "//ava.do/",
      "/shop",
      "ava.do",
      "",
    ];
    for (const url of urls) expect(safeNewsLink({ label: "Click", url })).toBeNull();
  });

  it("refuses a link without a proper label or url", () => {
    expect(safeNewsLink(undefined)).toBeNull();
    expect(safeNewsLink("https://ava.do/")).toBeNull();
    expect(safeNewsLink({ url: "https://ava.do/" })).toBeNull();
    expect(safeNewsLink({ label: "", url: "https://ava.do/" })).toBeNull();
    expect(safeNewsLink({ label: "x".repeat(41), url: "https://ava.do/" })).toBeNull();
    expect(safeNewsLink({ label: "Shop", url: 5 })).toBeNull();
  });
});

describe("isNewsVisible", () => {
  const parsed = extra => parseNews({ ...item, ...extra });

  it("shows an item for everyone, and nothing when there is no item", () => {
    expect(isNewsVisible(parsed(), { stats: {} })).toBe(true);
    expect(isNewsVisible(parsed(), {})).toBe(true);
    expect(isNewsVisible(null, { stats: {} })).toBe(false);
  });

  it("hides an item once its date has passed", () => {
    const news = parsed({ until: "2026-11-01T12:00:00Z" });
    expect(isNewsVisible(news, { now: Date.parse("2026-11-01T11:59:00Z") })).toBe(true);
    expect(isNewsVisible(news, { now: Date.parse("2026-11-01T12:01:00Z") })).toBe(false);
  });

  it('shows a "small-disk" item only on the box the disk kit fits', () => {
    const news = parsed({ audience: "small-disk" });
    expect(matchesAudience(news, smallDisk)).toBe(true);
    expect(isNewsVisible(news, { stats: smallDisk })).toBe(true);
    expect(isNewsVisible(news, { stats: bigDisk })).toBe(false);
    expect(isNewsVisible(news, { stats: {} })).toBe(false);
    expect(isNewsVisible(news, {})).toBe(false);
  });

  it("hides a dismissed id, and shows a new one", () => {
    expect(isNewsVisible(parsed(), { dismissed: [item.id] })).toBe(false);
    expect(isNewsVisible(parsed({ id: "another" }), { dismissed: [item.id] })).toBe(true);
  });
});

describe("dismissed news", () => {
  it("remembers dismissed ids in localStorage", () => {
    expect(readDismissedNews()).toEqual([]);
    dismissNews("a");
    dismissNews("b");
    dismissNews("a");
    expect(readDismissedNews()).toEqual(["b", "a"]);
    expect(JSON.parse(localStorage.getItem("avado.dismissedNews"))).toEqual(["b", "a"]);
  });

  it("keeps only the last 20 ids", () => {
    for (let i = 1; i <= 25; i++) dismissNews(`news-${i}`);
    const kept = readDismissedNews();
    expect(kept).toHaveLength(20);
    expect(kept[0]).toBe("news-6");
    expect(kept[19]).toBe("news-25");
  });

  it("survives broken or blocked storage", () => {
    localStorage.setItem("avado.dismissedNews", "{not json");
    expect(readDismissedNews()).toEqual([]);
    localStorage.setItem("avado.dismissedNews", '{"a":1}');
    expect(readDismissedNews()).toEqual([]);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => dismissNews("a")).not.toThrow();
    spy.mockRestore();
  });
});

describe("loadNews", () => {
  it("asks the server once per page load, with an 8 second timeout", async () => {
    const get = vi.fn().mockResolvedValue({ data: JSON.stringify(item) });
    const first = await loadNews({ mock: false, get });
    const second = await loadNews({ mock: false, get });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(NEWS_URL, { timeout: 8000 });
    expect(NEWS_URL).toBe("https://bo.ava.do/value/admin-news");
    expect(first).toMatchObject(item);
    expect(second).toBe(first);
  });

  it("gives null, without throwing, when there is no item, no answer or a bad one", async () => {
    const failures = [
      () => Promise.reject(Object.assign(Error("Request failed with status code 404"), { response: { status: 404 } })),
      () => Promise.reject(Object.assign(Error("timeout of 8000ms exceeded"), { code: "ECONNABORTED" })),
      () => Promise.reject(Error("Network Error")),
      () => {
        throw Error("sync failure");
      },
      () => Promise.resolve({ data: "<html>Not the news</html>" }),
      () => Promise.resolve({ data: JSON.stringify({ ...item, title: "" }) }),
      () => Promise.resolve(undefined),
    ];
    for (const get of failures) {
      resetNewsCache();
      await expect(loadNews({ mock: false, get })).resolves.toBeNull();
    }
  });

  it("serves a valid sample in mock mode without any network call", async () => {
    const get = vi.fn();
    const news = await loadNews({ mock: true, get });
    expect(get).not.toHaveBeenCalled();
    expect(news).toMatchObject({ id: MOCK_NEWS.id, title: MOCK_NEWS.title, body: MOCK_NEWS.body, link: MOCK_NEWS.link });
  });
});
