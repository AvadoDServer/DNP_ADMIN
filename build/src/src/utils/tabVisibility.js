import { eventChannel } from "redux-saga";

// Background polls (installed packages, chain data) only run while this tab
// is visible, so a forgotten tab does not keep the box busy.

export const tabVisible = () => typeof document === "undefined" || !document.hidden;

/** Emits each time this tab becomes visible again. */
export function visibilityChannel() {
  return eventChannel(emit => {
    if (typeof document === "undefined") return () => {};
    const onChange = () => {
      if (tabVisible()) emit("visible");
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  });
}
