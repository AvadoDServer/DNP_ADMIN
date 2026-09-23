import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useTheme } from "theme/ThemeProvider";
import { useMode } from "settings/ModeProvider";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
import DappnodeIdentity from "./dropdownMenus/DappnodeIdentity";
import "./sidebar.css";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match computer" }
];

const MODE_OPTIONS = [
  { value: "simple", label: "Simple" },
  { value: "advanced", label: "Advanced" }
];

/**
 * A small accessible single-select control used for both the
 * Light/Dark/Match-computer and Simple/Advanced switches — a labelled
 * group (`role="group"`) of plain toggle buttons (`aria-pressed`), as in
 * the mockups. Deliberately not `role="radiogroup"`/`"radio"`: that pattern
 * requires arrow-key roving focus between options (WAI-ARIA APG), which
 * these buttons don't implement — native Tab order between them is correct
 * for a toggle-button group.
 */
function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="sidebar-footer-segmented">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
          className="sidebar-footer-segment"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Sidebar footer — box identity, the theme switch, the Simple/Advanced
 * switch and the app version (spec §4: "Footer holds the box name, the
 * Light/Dark switch, the Simple/Advanced switch and the version").
 *
 * The box name button opens a small popover with the identity details
 * (node ID, external/internal IP) that used to live in the top bar's
 * DappnodeIdentity dropdown — moved here so they stay reachable now that
 * the top bar only holds search and notifications.
 */
export default function SidebarFooter() {
  const dappnodeParams = useSelector(getDappnodeParams) || {};
  const { preference, setPreference } = useTheme();
  const { mode, setMode } = useMode();
  const [identityOpen, setIdentityOpen] = useState(false);
  const identityRef = useRef(null);
  const identityTriggerRef = useRef(null);
  const identityPopoverRef = useRef(null);

  const boxName = dappnodeParams.name || "My AVADO";
  // REACT_APP_VERSION is only set by getVersionData.sh during the Docker
  // build (yarn build run straight from the repo, e.g. a preview build,
  // never sees it) — hide the line rather than show a bare "Version".
  const version = process.env.REACT_APP_VERSION;

  // Close on outside click / Escape, returning focus to the trigger button
  // in both cases (it isn't already there, unlike a close-by-clicking-the-
  // trigger-again toggle, which keeps focus on the button naturally).
  useEffect(() => {
    if (!identityOpen) return; // Prevent unnecessary listeners
    function closeAndRefocus() {
      setIdentityOpen(false);
      if (identityTriggerRef.current) identityTriggerRef.current.focus();
    }
    function handleMouseDown(e) {
      if (identityRef.current && !identityRef.current.contains(e.target)) closeAndRefocus();
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") closeAndRefocus();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [identityOpen]);

  // Move focus into the popover when it opens (WAI-ARIA dialog pattern).
  useEffect(() => {
    if (identityOpen && identityPopoverRef.current) identityPopoverRef.current.focus();
  }, [identityOpen]);

  return (
    <div className="sidebar-footer">
      <div ref={identityRef} className="relative">
        <button
          ref={identityTriggerRef}
          type="button"
          onClick={() => setIdentityOpen(open => !open)}
          aria-haspopup="dialog"
          aria-expanded={identityOpen}
          title="Box identity"
          data-testid="sidebar-identity-button"
          className="sidebar-footer-identity"
        >
          <span className="sidebar-footer-avatar" aria-hidden="true">
            AV
          </span>
          <span className="sidebar-footer-name">{boxName}</span>
        </button>
        {identityOpen && (
          <div
            ref={identityPopoverRef}
            role="dialog"
            aria-label="AVADO identity"
            tabIndex={-1}
            data-testid="sidebar-identity-popover"
            className="sidebar-footer-popover focus:outline-none"
          >
            <DappnodeIdentity />
          </div>
        )}
      </div>

      <SegmentedControl
        label="Theme"
        options={THEME_OPTIONS}
        value={preference}
        onChange={setPreference}
      />
      <SegmentedControl label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />

      {version && <div className="sidebar-footer-version">Version {version}</div>}
    </div>
  );
}
