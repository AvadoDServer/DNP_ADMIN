import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { LostDataCardView } from "pages/packages/components/LostDataCard";
import { STILL_COPYING_AFTER_MS } from "pages/packages/lostDataApi";

const { mockConfirm, api } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  api: { listLostData: vi.fn(), findLostData: vi.fn(), recoverLostData: vi.fn() },
}));
vi.mock("components/ConfirmDialog", () => ({ confirm: mockConfirm }));
// Only the remount test goes through lostDataApi's own recoverLostData.
vi.mock("API/rpcMethods", () => ({ default: api }));

const RP = "rocketpool.avado.dnp.dappnode.eth";
const DM = "dappmanager.dnp.dappnode.eth";
const dnp = { name: RP, manifest: { title: "Rocket Pool" } };
const packagesAt = version => [{ name: DM, isCore: true, version }, { ...dnp, version: "1.0.0" }];
const NEW = packagesAt("10.0.51");
const OLD = packagesAt("10.0.50");

const OLD_VOL = "rocketpool-avado-dnp-dappnode-eth_rocketpool";
const ANON = "f".repeat(64);
const SERVER_TIMEOUT =
  "Recovering the data took longer than 10 minutes and was stopped. Files already copied were kept; contact AVADO support.";
const SERVER_WARNING =
  "Some files already existed in the app's storage and were kept; the copy from the old storage was not used for them.";
const STILL_COPYING =
  "Still copying. This can take a while for a lot of data. You can leave this page and come back later.";

const candidate = (name, extra = {}) => ({
  name,
  anonymous: false,
  createdAt: "2025-03-01T12:00:00Z",
  entries: [".rocketpool", "data"],
  sizeKb: 2048,
  target: "rocketpoolavadodnpdappnodeeth_rocketpool",
  ...extra,
});
const entry = (candidates, recovered = []) => ({
  package: RP,
  live: [{ name: "rocketpoolavadodnpdappnodeeth_rocketpool", mountPath: "/rocketpool" }],
  candidates,
  recovered,
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderCard({ packages = NEW, found = entry([candidate(OLD_VOL)]), recover = vi.fn(), onFinished, card = dnp } = {}) {
  const find = vi.fn(() => (found instanceof Error ? Promise.reject(found) : Promise.resolve(found)));
  let view;
  await act(async () => {
    view = render(
      <LostDataCardView
        dnp={card}
        packages={packages}
        findLostDataImpl={find}
        recoverLostDataImpl={recover}
        recoveryInFlightImpl={() => null}
        onFinished={onFinished}
      />
    );
  });
  return { ...view, find, recover };
}

// Press "Recover data" on a row and confirm in the dialog.
async function recoverRow(row) {
  fireEvent.click(within(row).getByRole("button", { name: "Recover data" }));
  const opts = mockConfirm.mock.calls[mockConfirm.mock.calls.length - 1][0];
  await act(async () => {
    opts.onClick();
  });
  return opts;
}

const rows = () => screen.getAllByRole("listitem");
const statuses = () => screen.queryAllByRole("status").map(n => n.textContent);

beforeEach(() => {
  mockConfirm.mockReset();
  for (const f of Object.values(api)) f.mockReset();
});

describe("LostDataCard", () => {
  it("renders nothing and makes no call on a DAPPMANAGER older than 10.0.51", async () => {
    const { container, find } = await renderCard({ packages: OLD });
    expect(container).toBeEmptyDOMElement();
    expect(find).not.toHaveBeenCalled();
  });

  it("renders nothing and makes no call when the DAPPMANAGER is missing", async () => {
    const { container, find } = await renderCard({ packages: [] });
    expect(container).toBeEmptyDOMElement();
    expect(find).not.toHaveBeenCalled();
  });

  it("renders nothing and makes no call on a core package", async () => {
    const { container, find } = await renderCard({ card: { name: DM, isCore: true } });
    expect(container).toBeEmptyDOMElement();
    expect(find).not.toHaveBeenCalled();
  });

  it("stays hidden when there is nothing to recover, even with volumes recovered earlier", async () => {
    const { container, find } = await renderCard({ found: entry([], [{ volume: "done", at: "2025-06-02T08:00:00Z" }]) });
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith(RP);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden, with one debug line, when the scan fails", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      const { container } = await renderCard({ found: Error("boom") });
      expect(container).toBeEmptyDOMElement();
      expect(debug).toHaveBeenCalledTimes(1);
    } finally {
      debug.mockRestore();
    }
  });

  it("lists every candidate (date, size, contents) and, below, the volumes recovered earlier without a button", async () => {
    await renderCard({
      found: entry(
        [candidate(OLD_VOL), candidate(ANON, { anonymous: true, createdAt: null, entries: ["node", "wallet"], sizeKb: 1536000 })],
        [
          { volume: "done-1", at: "2025-06-02T08:00:00Z" },
          { volume: "done-2", at: null },
        ]
      ),
    });
    expect(screen.getByRole("heading", { name: "Data found in an unused storage volume" })).toBeInTheDocument();
    expect(rows()).toHaveLength(4);
    expect(rows()[0]).toHaveTextContent("Created March 1, 2025");
    expect(rows()[0]).toHaveTextContent("2.1 MB (.rocketpool, data)");
    expect(rows()[1]).toHaveTextContent("Date unknown");
    expect(rows()[1]).toHaveTextContent("1.6 GB (node, wallet)");
    expect(rows()[2]).toHaveTextContent("Recovered on June 2, 2025");
    expect(within(rows()[2]).queryByRole("button")).toBeNull();
    expect(rows()[3]).toHaveTextContent(/^Recovered/);
    expect(within(rows()[3]).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Recover data" })).toHaveLength(2);
  });

  it("warns on a low-confidence volume (amber caution above a secondary button), never on a high or unmarked one", async () => {
    const CAUTION =
      "This storage may belong to another app. Only recover it if this app lost its data after an update, and contact AVADO support if you are not sure.";
    await renderCard({
      found: entry([
        candidate(OLD_VOL, { confidence: "high" }),
        candidate(ANON, { anonymous: true, confidence: "low" }),
        candidate("unmarked"),
      ]),
    });
    const [high, low, unmarked] = rows();
    expect(screen.getAllByText(CAUTION)).toHaveLength(1);
    expect(within(low).getByText(CAUTION).className).toContain("bg-warning-subtle");
    const lowButton = within(low).getByRole("button", { name: "Recover data" });
    expect(within(low).getByText(CAUTION).compareDocumentPosition(lowButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lowButton.className).toContain("bg-surface");
    expect(lowButton.className).not.toContain("bg-accent ");
    for (const row of [high, unmarked]) {
      expect(row).not.toHaveTextContent("may belong to another app");
      expect(within(row).getByRole("button", { name: "Recover data" }).className).toContain("bg-accent");
    }
  });

  it("asks first, in plain words and with a non-red button, and only then recovers that volume", async () => {
    const recover = vi.fn(() => Promise.resolve({ files: 12, sizeKb: 2048, skipped: 0 }));
    await renderCard({ recover });
    fireEvent.click(screen.getByRole("button", { name: "Recover data" }));
    expect(recover).not.toHaveBeenCalled();
    const opts = mockConfirm.mock.calls[0][0];
    expect(opts.title).toBe("Recover the data?");
    expect(opts.text).toBe(
      "This copies the files from the old storage into the app's storage. Files that are already there are kept. The app restarts; this can take a few minutes. Nothing is deleted."
    );
    expect(opts.label).toBe("Recover data");
    expect(opts.variant).toBe("primary");
    await act(async () => {
      opts.onClick();
    });
    expect(recover).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledWith(RP, OLD_VOL);
  });

  it("shows the button loading and disables every button while it runs", async () => {
    const pending = deferred();
    const recover = vi.fn(() => pending.promise);
    await renderCard({ recover, found: entry([candidate(OLD_VOL), candidate(ANON)]) });
    await recoverRow(rows()[0]);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).toBeDisabled();
    expect(within(rows()[0]).getByRole("button")).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      pending.resolve({ files: 3, sizeKb: 10, skipped: 0 });
    });
  });

  it("on success says how many files came back, marks the row Recovered, scans again and tells Home", async () => {
    const onFinished = vi.fn();
    const recover = vi.fn(() => Promise.resolve({ files: 1234, sizeKb: 2048, skipped: 0 }));
    const { find } = await renderCard({ recover, onFinished, found: entry([candidate(OLD_VOL), candidate(ANON)]) });
    await recoverRow(rows()[0]);
    expect(statuses()).toEqual(["Done: 1234 files recovered. The app is starting again."]);
    await waitFor(() => expect(find).toHaveBeenCalledTimes(2));
    // The candidate row became a recovered row (after the open ones)
    expect(screen.getAllByRole("button", { name: "Recover data" })).toHaveLength(1);
    const done = rows().find(r => /Recovered on/.test(r.textContent));
    expect(done).toHaveTextContent("2.1 MB (.rocketpool, data)");
    expect(within(done).queryByRole("button")).toBeNull();
    expect(onFinished).toHaveBeenCalledWith(OLD_VOL);
  });

  it("counts the files that were already there, and shows the wallet warning in amber", async () => {
    const recover = vi.fn(() => Promise.resolve({ files: 100, sizeKb: 2048, skipped: 4, warning: SERVER_WARNING }));
    await renderCard({ recover });
    await recoverRow(rows()[0]);
    expect(statuses()).toEqual([
      "Done: 96 files recovered. 4 files were already in the app's storage and were kept. The app is starting again.",
      `${SERVER_WARNING} If the app does not work as before, contact AVADO support.`,
    ]);
    const warning = screen.getByText(/If the app does not work as before/);
    expect(warning.className).toContain("bg-warning-subtle");
    expect(warning.className).not.toContain("success");
  });

  it("stays visible after a recovery even when the DAPPMANAGER lists no candidate any more; its row replaces the local one", async () => {
    const recover = vi.fn(() => Promise.resolve({ files: 5, sizeKb: 2048, skipped: 0 }));
    const { find } = await renderCard({ recover });
    find.mockImplementation(() => Promise.resolve(entry([], [{ volume: OLD_VOL, at: "2026-10-11T10:00:00Z" }])));
    await recoverRow(rows()[0]);
    await waitFor(() => expect(find).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(rows()[0]).toHaveTextContent("Recovered on October 11, 2026"));
    expect(rows()).toHaveLength(1);
    expect(statuses()).toEqual(["Done: 5 files recovered. The app is starting again."]);
  });

  it("on failure shows the DAPPMANAGER's message word for word, scans again and lets the user try again", async () => {
    const onFinished = vi.fn();
    const recover = vi.fn(() => Promise.reject(Error(SERVER_TIMEOUT)));
    const { find } = await renderCard({ recover, onFinished });
    await recoverRow(rows()[0]);
    expect(screen.getByRole("alert")).toHaveTextContent(SERVER_TIMEOUT);
    await waitFor(() => expect(find).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Recover data" })).toBeEnabled();
    expect(rows()[0]).not.toHaveTextContent("Recovered");
    expect(onFinished).toHaveBeenCalledWith(OLD_VOL);
  });

  it("keeps waiting past 10 minutes: says it is still copying, keeps the buttons off, and a late success still shows Done", async () => {
    vi.useFakeTimers();
    try {
      const pending = deferred();
      const recover = vi.fn(() => pending.promise);
      const { find } = await renderCard({ recover, found: entry([candidate(OLD_VOL), candidate(ANON)]) });
      await recoverRow(rows()[0]);
      expect(statuses()).toEqual([]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(STILL_COPYING_AFTER_MS);
      });
      expect(statuses()).toEqual([STILL_COPYING]);
      expect(screen.queryByRole("alert")).toBeNull();
      for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(STILL_COPYING_AFTER_MS);
      });
      for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
      await act(async () => {
        pending.resolve({ files: 7, sizeKb: 1, skipped: 0 });
      });
      expect(statuses()).toEqual(["Done: 7 files recovered. The app is starting again."]);
      expect(find).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Recover data" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("coming back to the page during a recovery shows it running, with every button off, and then its outcome", async () => {
    const call = deferred();
    api.recoverLostData.mockReturnValue(call.promise);
    const find = vi.fn(() => Promise.resolve(entry([candidate(OLD_VOL), candidate(ANON)])));
    const mount = () => render(<LostDataCardView dnp={dnp} packages={NEW} findLostDataImpl={find} />);
    let first;
    await act(async () => {
      first = mount();
    });
    await recoverRow(rows()[0]);
    await waitFor(() => expect(api.recoverLostData).toHaveBeenCalledWith({ id: RP, volume: OLD_VOL }));
    first.unmount();

    await act(async () => {
      mount();
    });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).toBeDisabled();
    expect(within(rows()[0]).getByRole("button")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      call.resolve({ files: 42, sizeKb: 1, skipped: 0 });
    });
    await waitFor(() => expect(statuses()).toEqual(["Done: 42 files recovered. The app is starting again."]));
    expect(api.recoverLostData).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Recover data" })).toHaveLength(1);
  });
});
