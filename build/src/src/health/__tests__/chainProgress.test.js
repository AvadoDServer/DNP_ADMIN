import { epochProgress } from "health/chainProgress";
import { NETWORKS } from "health/clients";

const seenN = (n, tag) => Array.from({ length: n }, () => tag);

describe("epochProgress", () => {
  it("is fully in step: everything up to and including now is seen (0 behind)", () => {
    const now = (NETWORKS.mainnet.genesis + 100 * 12) * 1000; // wallSlot 100
    const p = epochProgress({ network: "mainnet", headSlot: 100, now });
    expect(p).toMatchObject({ epoch: 3, slotInEpoch: 4, wallSlot: 100, behind: 0 });
    expect(p.cells).toHaveLength(32);
    expect(p.cells).toEqual([...seenN(4, "seen"), "now", ...seenN(27, "future")]);
  });

  it("is a couple of slots behind, within the same epoch (2 behind)", () => {
    const now = (NETWORKS.mainnet.genesis + 100 * 12) * 1000; // wallSlot 100
    const p = epochProgress({ network: "mainnet", headSlot: 98, now });
    expect(p).toMatchObject({ epoch: 3, slotInEpoch: 4, wallSlot: 100, behind: 2 });
    expect(p.cells).toEqual(["seen", "seen", "seen", "missing", "now", ...seenN(27, "future")]);
  });

  it("is behind by more than an epoch's worth of slots (40 behind): no slot in the current epoch is seen yet", () => {
    const now = (NETWORKS.mainnet.genesis + 1000 * 12) * 1000; // wallSlot 1000, epoch 31, slotInEpoch 8
    const p = epochProgress({ network: "mainnet", headSlot: 960, now });
    expect(p).toMatchObject({ epoch: 31, slotInEpoch: 8, wallSlot: 1000, behind: 40 });
    expect(p.cells).toEqual([...seenN(8, "missing"), "now", ...seenN(23, "future")]);
  });

  it("uses the network's own slotsPerEpoch — gnosis has 16-slot epochs", () => {
    const now = (NETWORKS.gnosis.genesis + 50 * 5) * 1000; // wallSlot 50, epoch 3, slotInEpoch 2
    const p = epochProgress({ network: "gnosis", headSlot: 48, now });
    expect(p).toMatchObject({ epoch: 3, slotInEpoch: 2, wallSlot: 50, behind: 2 });
    expect(p.cells).toHaveLength(16);
    expect(p.cells).toEqual(["seen", "missing", "now", ...seenN(13, "future")]);
  });

  it("is null for an unknown network", () => {
    expect(epochProgress({ network: "not-a-network", headSlot: 100, now: Date.now() })).toBeNull();
    expect(epochProgress({ network: undefined, headSlot: 100, now: Date.now() })).toBeNull();
  });

  it("is null when headSlot is missing", () => {
    expect(epochProgress({ network: "mainnet", headSlot: undefined, now: Date.now() })).toBeNull();
    expect(epochProgress({ network: "mainnet", headSlot: null, now: Date.now() })).toBeNull();
  });

  it("treats headSlot 0 as a real value, not missing", () => {
    const now = NETWORKS.mainnet.genesis * 1000; // wallSlot 0
    const p = epochProgress({ network: "mainnet", headSlot: 0, now });
    expect(p).toMatchObject({ epoch: 0, slotInEpoch: 0, wallSlot: 0, behind: 0 });
    expect(p.cells[0]).toBe("now");
  });
});
