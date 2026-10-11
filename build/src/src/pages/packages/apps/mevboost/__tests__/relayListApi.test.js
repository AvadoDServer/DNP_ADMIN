import {
  parseRelayList,
  loadRelayList,
  resetRelayListCache,
  RELAYS_URL,
  BUNDLED,
} from "pages/packages/apps/mevboost/relayListApi";

const relay = over => ({
  id: "ultrasound",
  name: "Ultra Sound",
  url: "https://0x" + "a".repeat(96) + "@relay.ultrasound.money",
  about: "https://relay.ultrasound.money/",
  filtering: "none",
  recommended: true,
  status: "live",
  statusSince: "2026-10-11",
  note: "",
  ...over,
});
// One day after the bundled copy, and one day before it.
const doc = over => ({ schema: 1, updatedAt: "2099-01-01", network: "mainnet", relays: [relay()], ...over });
const older = doc({ updatedAt: "2000-01-01" });

beforeEach(() => resetRelayListCache());

describe("BUNDLED", () => {
  it("is a valid relay list with a date", () => {
    expect(parseRelayList(BUNDLED)).toEqual(BUNDLED);
    expect(BUNDLED.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(BUNDLED.relays.length).toBeGreaterThan(0);
  });
});

describe("parseRelayList", () => {
  it("reads a JSON string, a double-encoded string and an object", () => {
    expect(parseRelayList(JSON.stringify(doc()))).toEqual(doc());
    expect(parseRelayList(JSON.stringify(JSON.stringify(doc())))).toEqual(doc());
    expect(parseRelayList(doc())).toEqual(doc());
  });

  it("gives null for anything that is not a relay list", () => {
    const bad = [
      undefined,
      null,
      "",
      "<html><body>Not found</body></html>",
      "{",
      42,
      [],
      '"just a string"',
      {},
      doc({ schema: 2 }),
      doc({ schema: "1" }),
      doc({ relays: undefined }),
      doc({ relays: { a: relay() } }),
      doc({ relays: [null] }),
      doc({ relays: [relay(), "https://x"] }),
    ];
    for (const body of bad) expect(parseRelayList(body)).toBeNull();
  });

  it("gives null when a relay has no true/false recommended", () => {
    for (const value of [undefined, "true", 1, null]) {
      expect(parseRelayList(doc({ relays: [relay({ recommended: value })] }))).toBeNull();
    }
  });

  it("keeps the first of two relays with the same address", () => {
    const first = relay({ id: "first" });
    const second = relay({ id: "second" });
    const other = relay({ id: "other", url: "https://0x" + "b".repeat(96) + "@agnostic-relay.net" });
    expect(parseRelayList(doc({ relays: [first, other, second] })).relays).toEqual([first, other]);
  });

  it("gives null when a relay address is not https://0x<key>@host", () => {
    const key = "0x" + "a".repeat(96);
    const bad = [
      `https://${key}@relay.one,https://${key}@relay.two`,
      `https://${key}@relay one.org`,
      " https://" + key + "@relay.ultrasound.money",
      "https://relay.ultrasound.money",
      `http://${key}@relay.ultrasound.money`,
      `https://0x${"a".repeat(95)}@relay.ultrasound.money`,
      `https://${key}@relay.ultrasound.money/path`,
    ];
    for (const url of bad) expect(parseRelayList(doc({ relays: [relay({ url })] }))).toBeNull();
    for (const url of [`https://${key}@relay.ultrasound.money/`, `https://0x${"A".repeat(96)}@relay.example.org:8443`]) {
      expect(parseRelayList(doc({ relays: [relay({ url })] }))).not.toBeNull();
    }
  });

  it("gives null when no relay is both recommended and live", () => {
    expect(parseRelayList(doc({ relays: [] }))).toBeNull();
    expect(parseRelayList(doc({ relays: [relay({ recommended: false })] }))).toBeNull();
    expect(parseRelayList(doc({ relays: [relay({ status: "retired" })] }))).toBeNull();
    const other = relay({ id: "other", url: "https://0x" + "b".repeat(96) + "@agnostic-relay.net", recommended: false });
    expect(parseRelayList(doc({ relays: [other, relay()] }))).not.toBeNull();
  });

  it("gives null when a relay lacks id, name, url or status", () => {
    for (const key of ["id", "name", "url", "status"]) {
      expect(parseRelayList(doc({ relays: [relay({ [key]: undefined })] }))).toBeNull();
      expect(parseRelayList(doc({ relays: [relay({ [key]: "" })] }))).toBeNull();
      expect(parseRelayList(doc({ relays: [relay({ [key]: 7 })] }))).toBeNull();
    }
  });
});

describe("loadRelayList", () => {
  it("fetches once per page load, with an 8 second timeout", async () => {
    const get = vi.fn().mockResolvedValue({ data: JSON.stringify(doc()) });
    const first = await loadRelayList({ mock: false, get });
    const second = await loadRelayList({ mock: false, get });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(RELAYS_URL, { timeout: 8000 });
    expect(RELAYS_URL).toBe("https://bo.ava.do/value/mev-relays");
    expect(first).toEqual({ list: doc(), stale: false });
    expect(second).toBe(first);
  });

  it("fetches again after resetRelayListCache", async () => {
    const get = vi.fn().mockResolvedValue({ data: doc() });
    await loadRelayList({ mock: false, get });
    resetRelayListCache();
    await loadRelayList({ mock: false, get });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("uses the fetched list, as an object or a double-encoded string, when it is newer", async () => {
    for (const data of [doc(), JSON.stringify(JSON.stringify(doc()))]) {
      resetRelayListCache();
      await expect(loadRelayList({ mock: false, get: () => Promise.resolve({ data }) })).resolves.toEqual({
        list: doc(),
        stale: false,
      });
    }
  });

  it("uses the fetched list when it is from the same day as the bundled one", async () => {
    const same = doc({ updatedAt: BUNDLED.updatedAt });
    const result = await loadRelayList({ mock: false, get: () => Promise.resolve({ data: same }) });
    expect(result).toEqual({ list: same, stale: false });
  });

  it("keeps the bundled list, not stale, when the fetched one is older or has no date", async () => {
    for (const data of [older, doc({ updatedAt: undefined }), doc({ updatedAt: "next week" }), doc({ updatedAt: 20991231 })]) {
      resetRelayListCache();
      const result = await loadRelayList({ mock: false, get: () => Promise.resolve({ data }) });
      expect(result.list).toBe(BUNDLED);
      expect(result.stale).toBe(false);
    }
  });

  it("falls back to the bundled list, stale, without throwing, when the fetch fails or is malformed", async () => {
    const failures = [
      () => Promise.reject(Object.assign(Error("Request failed with status code 404"), { response: { status: 404 } })),
      () => Promise.reject(Object.assign(Error("timeout of 8000ms exceeded"), { code: "ECONNABORTED" })),
      () => Promise.reject(Error("Network Error")),
      () => {
        throw Error("sync failure");
      },
      () => Promise.resolve({ data: "<!doctype html><html><body>Bad gateway</body></html>" }),
      () => Promise.resolve({ data: doc({ schema: 2 }) }),
      () => Promise.resolve(undefined),
      // A relay address with a comma, a space or no key, and a list with no relays.
      () => Promise.resolve({ data: doc({ relays: [relay({ url: relay().url + ",https://0x" + "b".repeat(96) + "@evil.example" })] }) }),
      () => Promise.resolve({ data: doc({ relays: [relay({ url: relay().url.replace("@", "@ ") })] }) }),
      () => Promise.resolve({ data: doc({ relays: [relay({ url: "https://relay.ultrasound.money" })] }) }),
      () => Promise.resolve({ data: doc({ relays: [] }) }),
    ];
    for (const get of failures) {
      resetRelayListCache();
      const result = await loadRelayList({ mock: false, get });
      expect(result.list).toBe(BUNDLED);
      expect(result.stale).toBe(true);
    }
  });

  it("serves the bundled list, not stale, in mock mode without any network call", async () => {
    const get = vi.fn();
    await expect(loadRelayList({ mock: true, get })).resolves.toEqual({ list: BUNDLED, stale: false });
    expect(get).not.toHaveBeenCalled();
  });
});
