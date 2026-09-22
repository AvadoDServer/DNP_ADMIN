// DropdownMenu components
import ChainData from "./dropdownMenus/ChainData";
import DappnodeIdentity from "./dropdownMenus/DappnodeIdentity/index.jsx";
import Notifications from "./dropdownMenus/Notifications";
import Report from "./dropdownMenus/Report";
// Components
import ThemeToggle from "../ThemeToggle";
import { toggleSideNav } from "./SideBar";
// Icons
import MenuBurger from "Icons/MenuBurger";
import { FiSearch } from "react-icons/fi";
// Palette
import { OPEN_PALETTE_EVENT } from "components/palette/CommandPalette";
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
      className="group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg focus:outline-none focus-visible:shadow-focus"
    >
      <FiSearch size="1.05em" aria-hidden="true" />
      <span className="topbar-label">Search</span>
      <span className="topbar-label rounded border border-border px-1 font-mono text-[0.7rem] text-fg-subtle">
        {hint}
      </span>
    </button>
  );
}

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
      <div className="topnav-icon-separator" />
      <DappnodeIdentity />
      <div className="topnav-icon-separator" />
      <ThemeToggle />
      <div className="topnav-icon-separator" />
      <ChainData />
      <Notifications />
      <div className="topnav-icon-separator" />
      <Report />
    </div>
  </div>
);

export default TopBar;
