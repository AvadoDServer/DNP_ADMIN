// DropdownMenu components
import Notifications from "./dropdownMenus/Notifications";
// Components
import { toggleSideNav } from "./SideBar";
// Icons
import MenuBurger from "Icons/MenuBurger";
import { FiSearch } from "react-icons/fi";
// Palette
import { OPEN_PALETTE_EVENT } from "components/palette/constants";
// Styles
import "./notifications.css";
import "./topbar.css";

const isMacPlatform = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || "");

/**
 * Opens the ⌘K command palette (mounted once in App.jsx) by dispatching a
 * plain window event — keeps the palette and the top bar decoupled.
 */
function SearchButton() {
  const openPalette = () => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
  const hint = isMacPlatform() ? "⌘K" : "Ctrl K";

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Search"
      title="Search"
      className="group relative inline-flex h-[42px] w-[42px] items-center justify-center gap-2.5 rounded-[12px] border border-border bg-surface px-0 text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg focus:outline-none focus-visible:shadow-focus lg:w-auto lg:min-w-[280px] lg:justify-start lg:px-3.5"
    >
      <FiSearch size="1.05em" aria-hidden="true" className="shrink-0" />
      <span className="topbar-label flex-grow text-left">Search or jump to…</span>
      <span className="topbar-label rounded border border-border px-1 font-mono text-[0.7rem] text-fg-subtle">
        {hint}
      </span>
    </button>
  );
}

// Slimmed top bar (spec §4): only the palette opener and notifications stay
// here — theme, mode, identity and chain status moved into the sidebar
// footer / chain strip.
const TopBar = () => (
  <div id="topbar">
    {/* Left justified items */}
    <div className="left">
      <button className="sidenav-toggler" onClick={toggleSideNav}>
        <MenuBurger />
      </button>
    </div>
    {/* Right justified items */}
    <div className="avado right">
      <SearchButton />
      <Notifications />
    </div>
  </div>
);

export default TopBar;
