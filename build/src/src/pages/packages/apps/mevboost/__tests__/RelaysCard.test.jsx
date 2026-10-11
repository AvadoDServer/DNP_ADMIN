import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { RelaysCardView } from "pages/packages/apps/mevboost/RelaysCard";
import { loadRelayList } from "pages/packages/apps/mevboost/relayListApi";
import { MEVBOOST_PACKAGE } from "health/clients";

vi.mock("pages/packages/apps/mevboost/relayListApi", () => ({ loadRelayList: vi.fn() }));

const key = c => "0x" + c.repeat(96);
const url = (c, host) => `https://${key(c)}@${host}`;
const relay = over => ({ about: "", filtering: "none", recommended: true, status: "live", statusSince: "2026-10-11", note: "", ...over });
const ULTRA = url("a", "relay.ultrasound.money");
const AGNOSTIC = url("b", "agnostic-relay.net");
const TITAN = url("c", "regional.titanrelay.xyz");
const ETHICAL = url("d", "bloxroute.ethical.blxrbdn.com");
const CUSTOM = url("e", "my.custom.relay");
const list = {
  schema: 1,
  updatedAt: "2026-10-11",
  network: "mainnet",
  relays: [
    relay({ id: "ultrasound", name: "Ultra Sound", url: ULTRA, about: "https://relay.ultrasound.money/" }),
    relay({ id: "agnostic", name: "Agnostic Gnosis", url: AGNOSTIC }),
    relay({ id: "titan-regional", name: "Titan Relay Regional", url: TITAN, filtering: "sanctions", recommended: false }),
    relay({ id: "bloxroute-ethical", name: "bloXroute Ethical", url: ETHICAL, filtering: "sanctions", recommended: false, status: "retired" }),
    relay({ id: "manifold", name: "Manifold", url: url("f", "mainnet-relay.securerpc.com"), recommended: false, status: "retired" }),
  ],
};
const dnpWith = envs => ({
  name: MEVBOOST_PACKAGE,
  manifest: { image: { environment: ["NETWORK=mainnet", `RELAYS=${ULTRA}`, "EXTRA_OPTS="] } },
  envs,
});
const boxDnp = dnpWith({ RELAYS: [ULTRA, ETHICAL, CUSTOM].join(","), EXTRA_OPTS: "-min-bid 0.05" });

async function renderCard({ dnp = boxDnp, stale = false, updateEnvs = vi.fn(() => Promise.resolve()) } = {}) {
  loadRelayList.mockResolvedValue({ list, stale });
  let view;
  await act(async () => {
    view = render(<RelaysCardView dnp={dnp} updateEnvs={updateEnvs} />);
  });
  return { ...view, updateEnvs };
}

const box = name => screen.getByRole("checkbox", { name: new RegExp(name) });
const row = name => box(name).closest("li");
const save = () => screen.getByRole("button", { name: "Save" });
// Save settles asynchronously (the saving flag clears when updateEnvs resolves).
const clickSave = () =>
  act(async () => {
    fireEvent.click(save());
  });
const useRecommended = () => screen.getByRole("button", { name: "Use recommended" });

describe("RelaysCard", () => {
  it("shows a loading placeholder until the list is there", () => {
    loadRelayList.mockReturnValue(new Promise(() => {}));
    render(<RelaysCardView dnp={boxDnp} updateEnvs={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Relays" })).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("shows the intro and one row per list relay, the retired one the box has, and the custom one", async () => {
    await renderCard();
    expect(screen.getByText(/Relays are where block builders send bids/)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(5);
    expect(box("Ultra Sound")).toBeChecked();
    expect(box("Agnostic Gnosis")).not.toBeChecked();
    expect(box("Titan Relay Regional")).not.toBeChecked();
    expect(box("bloXroute Ethical")).toBeChecked();
    expect(box("my.custom.relay")).toBeChecked();
    // A retired relay the box does not have is not offered.
    expect(screen.queryByRole("checkbox", { name: /Manifold/ })).toBeNull();
    // The checkboxes are one named group.
    expect(within(screen.getByRole("group", { name: "Relays" })).getAllByRole("checkbox")).toHaveLength(5);
  });

  it("labels each row: filtering, retired, custom and the about link", async () => {
    await renderCard();
    expect(within(row("Ultra Sound")).getByText("No filtering")).toBeInTheDocument();
    expect(within(row("Titan Relay Regional")).getByText("Filters sanctioned transactions")).toBeInTheDocument();
    expect(within(row("bloXroute Ethical")).getByText("No longer running")).toBeInTheDocument();
    expect(within(row("Ultra Sound")).queryByText("No longer running")).toBeNull();
    expect(within(row("bloXroute Ethical")).getByText("Untick it, or press Use recommended.")).toBeInTheDocument();
    expect(within(row("Ultra Sound")).queryByText("Untick it, or press Use recommended.")).toBeNull();

    const custom = row("my.custom.relay");
    expect(within(custom).getByText("Custom relay")).toBeInTheDocument();
    expect(within(custom).queryByText("No filtering")).toBeNull();
    expect(within(custom).queryByText("Filters sanctioned transactions")).toBeNull();
    expect(within(custom).queryByRole("link")).toBeNull();

    const about = within(row("Ultra Sound")).getByRole("link", { name: "About Ultra Sound" });
    expect(about).toHaveTextContent("About");
    expect(about).toHaveAttribute("href", "https://relay.ultrasound.money/");
    expect(about).toHaveAttribute("target", "_blank");
    expect(about).toHaveAttribute("rel", "noreferrer");
    // No about address, no link.
    expect(within(row("Agnostic Gnosis")).queryByRole("link")).toBeNull();
  });

  it("marks a known relay written with another key", async () => {
    await renderCard({ dnp: dnpWith({ RELAYS: url("9", "relay.ultrasound.money") }) });
    const other = row("relay.ultrasound.money");
    expect(within(other).getByText("Key differs from the known one")).toBeInTheDocument();
    expect(within(other).getByText("Custom relay")).toBeInTheDocument();
    expect(box("Ultra Sound")).not.toBeChecked();
  });

  it("Use recommended swaps a rotated key on a recommended relay for the list's address", async () => {
    const rotated = url("9", "relay.ultrasound.money");
    const { updateEnvs } = await renderCard({ dnp: dnpWith({ RELAYS: [rotated, CUSTOM].join(","), EXTRA_OPTS: "" }) });
    fireEvent.click(useRecommended());
    expect(box("relay.ultrasound.money")).not.toBeChecked();
    expect(box("my.custom.relay")).toBeChecked();
    await clickSave();
    expect(updateEnvs.mock.calls[0][1].RELAYS).toBe([ULTRA, AGNOSTIC, CUSTOM].join(","));
  });

  it("shows the box's minimum bid", async () => {
    await renderCard();
    expect(screen.getByRole("radio", { name: "Only bids above" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Take every bid (recommended)" })).not.toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Amount in ETH" })).toHaveValue(0.05);
    expect(screen.getByText(/With a minimum, your AVADO builds its own block/)).toBeInTheDocument();
  });

  it("shows no amount field when the box takes every bid", async () => {
    await renderCard({ dnp: dnpWith({ RELAYS: ULTRA, EXTRA_OPTS: "" }) });
    expect(screen.getByRole("radio", { name: "Take every bid (recommended)" })).toBeChecked();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("keeps Save off until something changes", async () => {
    await renderCard();
    expect(save()).toBeDisabled();
    fireEvent.click(box("Agnostic Gnosis"));
    expect(save()).toBeEnabled();
  });

  it("Use recommended ticks exactly the recommended live relays, keeps the custom one and takes every bid", async () => {
    await renderCard();
    fireEvent.click(useRecommended());
    expect(box("Ultra Sound")).toBeChecked();
    expect(box("Agnostic Gnosis")).toBeChecked();
    expect(box("Titan Relay Regional")).not.toBeChecked();
    expect(box("bloXroute Ethical")).not.toBeChecked();
    expect(box("my.custom.relay")).toBeChecked();
    expect(screen.getByRole("radio", { name: "Take every bid (recommended)" })).toBeChecked();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("Save writes the relays and the minimum, passing the other settings through", async () => {
    const { updateEnvs } = await renderCard();
    fireEvent.click(useRecommended());
    await clickSave();
    expect(updateEnvs).toHaveBeenCalledTimes(1);
    expect(updateEnvs).toHaveBeenCalledWith(MEVBOOST_PACKAGE, {
      NETWORK: "mainnet",
      RELAYS: [ULTRA, AGNOSTIC, CUSTOM].join(","),
      EXTRA_OPTS: "",
    });
  });

  it("Save writes a new minimum, rounded to 4 decimals", async () => {
    const { updateEnvs } = await renderCard();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount in ETH" }), { target: { value: "0.123456" } });
    await clickSave();
    expect(updateEnvs.mock.calls[0][1].EXTRA_OPTS).toBe("-min-bid 0.1235");
    expect(updateEnvs.mock.calls[0][1].RELAYS).toBe([ULTRA, ETHICAL, CUSTOM].join(","));
  });

  it("asks for an amount within AVADO's limits and keeps Save off until there is one", async () => {
    await renderCard({ dnp: dnpWith({ RELAYS: ULTRA, EXTRA_OPTS: "" }) });
    fireEvent.click(screen.getByRole("radio", { name: "Only bids above" }));
    const amount = screen.getByRole("spinbutton", { name: "Amount in ETH" });
    expect(amount).toHaveAttribute("step", "0.001");
    expect(amount).toHaveAttribute("min", "0.001");
    const message = "Enter an amount between 0.001 and 1 ETH. Larger or smaller values can be set in the advanced settings.";
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription(message);
    expect(save()).toBeDisabled();
    fireEvent.change(amount, { target: { value: "5" } });
    expect(save()).toBeDisabled();
    fireEvent.change(amount, { target: { value: "0.02" } });
    expect(screen.queryByText(message)).toBeNull();
    expect(amount).not.toHaveAttribute("aria-invalid");
    expect(save()).toBeEnabled();
  });

  for (const value of ["-min-bid 2", "-min-bid 0.0005", "-min-bid 0.12345"]) {
    it(`leaves a minimum outside the card's range as it is (${value})`, async () => {
      const { updateEnvs } = await renderCard({ dnp: dnpWith({ RELAYS: ULTRA, EXTRA_OPTS: value }) });
      expect(screen.getByText("A custom value is set in the advanced settings and is left as it is.")).toBeInTheDocument();
      for (const radio of screen.getAllByRole("radio")) {
        expect(radio).toBeDisabled();
        expect(radio).not.toBeChecked();
      }
      expect(screen.queryByRole("spinbutton")).toBeNull();
      expect(screen.queryByText(/Enter an amount/)).toBeNull();
      expect(save()).toBeDisabled();
      fireEvent.click(box("Agnostic Gnosis"));
      expect(save()).toBeEnabled();
      await clickSave();
      expect(updateEnvs).toHaveBeenCalledWith(MEVBOOST_PACKAGE, { NETWORK: "mainnet", RELAYS: [ULTRA, AGNOSTIC].join(","), EXTRA_OPTS: value });
    });

    it(`Use recommended takes every bid over a readable minimum outside the card's range, keeping other options (${value})`, async () => {
      const { updateEnvs } = await renderCard({ dnp: dnpWith({ RELAYS: ULTRA, EXTRA_OPTS: `-json ${value}` }) });
      fireEvent.click(useRecommended());
      expect(screen.getByRole("radio", { name: "Take every bid (recommended)" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Only bids above" })).toBeEnabled();
      expect(screen.queryByText(/A custom value is set/)).toBeNull();
      expect(screen.getByText("Other options are set and are kept as they are: -json")).toBeInTheDocument();
      await clickSave();
      expect(updateEnvs.mock.calls[0][1].EXTRA_OPTS).toBe("-json");
    });
  }

  it("unticking every relay turns Save off and says why", async () => {
    await renderCard();
    expect(screen.queryByText("Tick at least one relay that is still running.")).toBeNull();
    for (const name of ["Ultra Sound", "bloXroute Ethical", "my.custom.relay"]) fireEvent.click(box(name));
    expect(screen.getByRole("status")).toHaveTextContent("Tick at least one relay that is still running.");
    expect(save()).toBeDisabled();
  });

  it("keeps Save off when only a retired relay is ticked", async () => {
    await renderCard({ dnp: dnpWith({ RELAYS: [ULTRA, ETHICAL].join(","), EXTRA_OPTS: "" }) });
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(box("Ultra Sound"));
    expect(box("bloXroute Ethical")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("Tick at least one relay that is still running.");
    expect(save()).toBeDisabled();
    fireEvent.click(box("Agnostic Gnosis"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(save()).toBeEnabled();
  });

  it("on a box with no relays, points to Use recommended and saves the recommended set", async () => {
    const { updateEnvs } = await renderCard({ dnp: dnpWith({ RELAYS: "", EXTRA_OPTS: "" }) });
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    for (const name of ["Ultra Sound", "Agnostic Gnosis", "Titan Relay Regional"]) expect(box(name)).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /bloXroute Ethical/ })).toBeNull();
    expect(screen.getByText('No relays are set yet. Press "Use recommended" to pick a good set.')).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(save()).toBeDisabled();
    fireEvent.click(useRecommended());
    expect(screen.queryByText(/No relays are set yet/)).toBeNull();
    await clickSave();
    expect(updateEnvs).toHaveBeenCalledWith(MEVBOOST_PACKAGE, { NETWORK: "mainnet", RELAYS: [ULTRA, AGNOSTIC].join(","), EXTRA_OPTS: "" });
  });

  it("keeps Save off when the changes add up to what the box already has", async () => {
    await renderCard();
    fireEvent.click(box("Agnostic Gnosis"));
    expect(save()).toBeEnabled();
    fireEvent.click(box("Agnostic Gnosis"));
    expect(save()).toBeDisabled();
    // Same minimum typed again.
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount in ETH" }), { target: { value: "0.050" } });
    expect(save()).toBeDisabled();
  });

  it("turns Save off while saving, and back on when the save fails", async () => {
    let fail;
    const updateEnvs = vi.fn(() => new Promise((resolve, reject) => (fail = reject)));
    await renderCard({ updateEnvs });
    fireEvent.click(box("Agnostic Gnosis"));
    fireEvent.click(save());
    expect(save()).toBeDisabled();
    fireEvent.click(save());
    expect(updateEnvs).toHaveBeenCalledTimes(1);
    await act(async () => fail(Error("Could not save")));
    // The box still has the old settings, so the change is still there to save.
    expect(box("Agnostic Gnosis")).toBeChecked();
    expect(save()).toBeEnabled();
  });

  it("keeps unsaved edits when the package list refreshes with the same settings", async () => {
    const { rerender, updateEnvs } = await renderCard();
    fireEvent.click(box("Agnostic Gnosis"));
    await act(async () => {
      rerender(<RelaysCardView dnp={{ ...boxDnp, envs: { ...boxDnp.envs }, state: "running" }} updateEnvs={updateEnvs} />);
    });
    expect(box("Agnostic Gnosis")).toBeChecked();
    expect(save()).toBeEnabled();
  });

  it("toggles rows by address, so two custom relays on one host stay apart", async () => {
    const one = url("e", "same.custom.relay");
    const two = url("7", "same.custom.relay");
    const { updateEnvs } = await renderCard({ dnp: dnpWith({ RELAYS: [one, two].join(","), EXTRA_OPTS: "" }) });
    const both = screen.getAllByRole("checkbox", { name: /same\.custom\.relay/ });
    expect(both).toHaveLength(2);
    fireEvent.click(both[0]);
    expect(both[0]).not.toBeChecked();
    expect(both[1]).toBeChecked();
    await clickSave();
    expect(updateEnvs.mock.calls[0][1].RELAYS).toBe(two);
  });

  it("says when it shows the bundled list because it could not check for a newer one", async () => {
    await renderCard({ stale: true });
    const note = screen.getByText("Showing the relay list from October 11, 2026. Your AVADO could not check for a newer one.");
    expect(note).toHaveClass("text-fg-muted");
    expect(note).not.toHaveClass("text-warning-text");
  });

  it("shows no such note when the list is current", async () => {
    await renderCard();
    expect(screen.queryByText(/could not check for a newer one/)).toBeNull();
  });

  it("leaves a minimum it cannot read as it is", async () => {
    const { updateEnvs } = await renderCard({ dnp: dnpWith({ RELAYS: ULTRA, EXTRA_OPTS: "-min-bid abc" }) });
    expect(screen.getByText("A custom value is set in the advanced settings and is left as it is.")).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(screen.queryByText(/Other options are set/)).toBeNull();
    fireEvent.click(useRecommended());
    await clickSave();
    expect(updateEnvs.mock.calls[0][1].EXTRA_OPTS).toBe("-min-bid abc");
  });

  it("shows other options and keeps them on Save", async () => {
    const { updateEnvs } = await renderCard({
      dnp: dnpWith({ RELAYS: ULTRA, EXTRA_OPTS: "-min-bid 0.05 -request-timeout-getheader 1500" }),
    });
    expect(screen.getByText("Other options are set and are kept as they are: -request-timeout-getheader 1500")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Take every bid (recommended)" }));
    await clickSave();
    expect(updateEnvs.mock.calls[0][1].EXTRA_OPTS).toBe("-request-timeout-getheader 1500");
  });

  it("starts over from the box's settings when they change", async () => {
    const { rerender, updateEnvs } = await renderCard();
    fireEvent.click(box("Agnostic Gnosis"));
    expect(save()).toBeEnabled();
    await act(async () => {
      rerender(<RelaysCardView dnp={dnpWith({ RELAYS: AGNOSTIC, EXTRA_OPTS: "" })} updateEnvs={updateEnvs} />);
    });
    expect(box("Agnostic Gnosis")).toBeChecked();
    expect(box("Ultra Sound")).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Take every bid (recommended)" })).toBeChecked();
    expect(save()).toBeDisabled();
  });

  it("tells the user that saving restarts MEV-Boost", async () => {
    await renderCard();
    expect(screen.getByText("Saving restarts MEV-Boost. Your validators keep running.")).toBeInTheDocument();
  });
});
