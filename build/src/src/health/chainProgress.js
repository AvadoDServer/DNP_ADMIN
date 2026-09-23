import { NETWORKS, currentSlot } from "health/clients";

// Turns a client's head slot into the current epoch's slot-by-slot picture
// used by the Home chain strip (Advanced mode): which slots the client has
// already reported (`seen`), which are between what it has reported and
// wall-clock "now" (`missing` — not necessarily missed forever, just not
// seen by this client yet), which slot is "now", and which are still
// `future` within this epoch.
export function epochProgress({ network, headSlot, now }) {
  const net = NETWORKS[network];
  if (!net || headSlot == null) return null;

  const wallSlot = currentSlot(network, now);
  if (wallSlot == null) return null;

  const { slotsPerEpoch } = net;
  const epoch = Math.floor(wallSlot / slotsPerEpoch);
  const slotInEpoch = wallSlot - epoch * slotsPerEpoch;
  const epochStart = epoch * slotsPerEpoch;
  // A client's reported head can be ahead of this tab's wall-clock estimate
  // (clock drift, a slightly-stale `now`, etc.) — clamp so "behind" never
  // reads negative; `ahead` surfaces that case instead, for callers that
  // want it.
  const behind = Math.max(0, wallSlot - headSlot);
  const ahead = Math.max(0, headSlot - wallSlot);

  const cells = Array.from({ length: slotsPerEpoch }, (_, i) => {
    const slot = epochStart + i;
    // "now" is a hard boundary: even when the head is ahead of wall-clock
    // (headSlot >= wallSlot), nothing after "now" is ever "seen" — a strip
    // that shows the future as already-attested would be misleading.
    if (slot === wallSlot) return "now";
    if (slot < wallSlot) return slot <= headSlot ? "seen" : "missing";
    return "future";
  });

  return { epoch, slotInEpoch, wallSlot, behind, ahead, cells };
}
