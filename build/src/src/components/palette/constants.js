// Shared between CommandPalette.jsx and the top-bar Search button. Kept in
// its own tiny module (instead of on CommandPalette.jsx) so TopBar.jsx can
// depend on just the event name, not the whole palette component tree.
export const OPEN_PALETTE_EVENT = "avado:open-palette";
