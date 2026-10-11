import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { LostDataCardView } from "pages/packages/components/LostDataCard";

const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));
vi.mock("components/ConfirmDialog", () => ({ confirm: mockConfirm }));

const RP = "rocketpool.avado.dnp.dappnode.eth";
const DM = "dappmanager.dnp.dappnode.eth";
const dnp = { name: RP, manifest: { title: "Rocket Pool" } };
const packagesAt = version => [{ name: DM, isCore: true, version }, { ...dnp, version: "1.0.0" }];
const NEW = packagesAt("10.0.51");
const OLD = packagesAt("10.0.50");

const OLD_VOL = "rocketpool-avado-dnp-dappnode-eth_rocketpool";
const ANON = "f".repeat(64);
const candidate = (name, extra = {}) => ({
  name,
  anonymous: false,
  createdAt: "2025-03-01T12:00:00Z",
  entries: [".rocketpool", "data"],
  sizeKb: 2048,
  target: "rocketpoolavadodnpdappnodeeth_rocketpool",
  ...extra,
});
const entry = candidates => ({ package: RP, live: [{ name: "rocketpoolavadodnpdappnodeeth_rocketpool", mountPath: "/rocketpool" }], candidates });

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderCard({ packages = NEW, found = entry([candidate(OLD_VOL)]), recover = vi.fn(), onRecovered } = {}) {
  const find = vi.fn(() => (found instanceof Error ? Promise.reject(found) : Promise.resolve(found)));
  let view;
  await act(async () => {
    view = render(
      <LostDataCardView dnp={dnp} packages={packages} findLostDataImpl={find} recoverLostDataImpl={recover} onRecovered={onRecovered} />
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

beforeEach(() => {
  mockConfirm.mockReset();
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
    const find = vi.fn(() => Promise.resolve(entry([candidate(OLD_VOL)])));
    let view;
    await act(async () => {
      view = render(<LostDataCardView dnp={{ name: DM, isCore: true }} packages={NEW} findLostDataImpl={find} recoverLostDataImpl={vi.fn()} />);
    });
    expect(view.container).toBeEmptyDOMElement();
    expect(find).not.toHaveBeenCalled();
  });

  it("stays hidden when there is nothing to recover", async () => {
    const { container, find } = await renderCard({ found: entry([]) });
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

  it("lists every candidate: date, size and what is in it", async () => {
    await renderCard({
      found: entry([candidate(OLD_VOL), candidate(ANON, { anonymous: true, createdAt: null, entries: ["node", "wallet"], sizeKb: 1536000 })]),
    });
    expect(screen.getByRole("heading", { name: "Data found in an unused storage volume" })).toBeInTheDocument();
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent("Created March 1, 2025");
    expect(rows()[0]).toHaveTextContent("2.1 MB (.rocketpool, data)");
    expect(rows()[1]).toHaveTextContent("Date unknown");
    expect(rows()[1]).toHaveTextContent("1.6 GB (node, wallet)");
    expect(screen.getAllByRole("button", { name: "Recover data" })).toHaveLength(2);
  });

  it("asks first, in plain words, and only then recovers that volume", async () => {
    const recover = vi.fn(() => Promise.resolve({ files: 12, sizeKb: 2048 }));
    await renderCard({ recover });
    fireEvent.click(screen.getByRole("button", { name: "Recover data" }));
    expect(recover).not.toHaveBeenCalled();
    const opts = mockConfirm.mock.calls[0][0];
    expect(opts.title).toBe("Recover the data?");
    expect(opts.text).toBe(
      "This copies the files from the old storage into the app's storage. Files that are already there are kept. The app restarts; this can take a few minutes. Nothing is deleted."
    );
    expect(opts.label).toBe("Recover data");
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
      pending.resolve({ files: 3, sizeKb: 10 });
    });
  });

  it("on success says how many files came back, marks the row Recovered and scans again", async () => {
    const onRecovered = vi.fn();
    const recover = vi.fn(() => Promise.resolve({ files: 1234, sizeKb: 2048 }));
    const { find } = await renderCard({ recover, onRecovered, found: entry([candidate(OLD_VOL), candidate(ANON)]) });
    await recoverRow(rows()[0]);
    expect(screen.getByRole("status")).toHaveTextContent("Done: 1234 files recovered. The app is starting again.");
    await waitFor(() => expect(find).toHaveBeenCalledTimes(2));
    // The DAPPMANAGER still lists the old volume (it stays unused): only the button goes
    expect(within(rows()[0]).queryByRole("button")).toBeNull();
    expect(rows()[0]).toHaveTextContent("Recovered");
    expect(within(rows()[1]).getByRole("button", { name: "Recover data" })).toBeEnabled();
    expect(onRecovered).toHaveBeenCalledWith(OLD_VOL);
  });

  it("keeps a recovered row when the next scan no longer lists it", async () => {
    const recover = vi.fn(() => Promise.resolve({ files: 5, sizeKb: 2048 }));
    const found = entry([candidate(OLD_VOL)]);
    const { find } = await renderCard({ recover, found });
    find.mockImplementation(() => Promise.resolve(entry([])));
    await recoverRow(rows()[0]);
    await waitFor(() => expect(find).toHaveBeenCalledTimes(2));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Recovered");
    expect(screen.getByRole("status")).toHaveTextContent("Done: 5 files recovered.");
  });

  it("on failure shows the DAPPMANAGER's message and lets the user try again", async () => {
    const onRecovered = vi.fn();
    const recover = vi.fn(() => Promise.reject(Error("That volume is not on the list any more. Reload the page and try again.")));
    await renderCard({ recover, onRecovered });
    await recoverRow(rows()[0]);
    expect(screen.getByRole("alert")).toHaveTextContent("That volume is not on the list any more. Reload the page and try again.");
    expect(screen.getByRole("button", { name: "Recover data" })).toBeEnabled();
    expect(rows()[0]).not.toHaveTextContent("Recovered");
    expect(onRecovered).not.toHaveBeenCalled();
  });
});
