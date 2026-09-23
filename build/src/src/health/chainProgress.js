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
  const behind = wallSlot - headSlot;

  const cells = Array.from({ length: slotsPerEpoch }, (_, i) => {
    const slot = epochStart + i;
    if (slot === wallSlot) return "now";
    if (slot <= headSlot) return "seen";
    if (slot < wallSlot) return "missing";
    return "future";
  });

  return { epoch, slotInEpoch, wallSlot, behind, cells };
}
