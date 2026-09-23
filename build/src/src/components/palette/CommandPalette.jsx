import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiSearch } from "react-icons/fi";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { useHealth } from "health/HealthProvider";
import { useMode } from "settings/ModeProvider";
import { visibleNavItems } from "settings/visibility";
import { useTheme } from "theme/ThemeProvider";
import { sidenavItems } from "components/navbar/navbarItems";
import { TOPICS } from "pages/troubleshoot/topics";
import { restartPackage } from "pages/packages/actions";
import confirmRestartPackage from "pages/packages/components/confirmRestartPackage";
import { confirmSignedCmd } from "pages/system/components/SystemPresentation";
import { runSignedCmd } from "pages/system/actions";
import { DISK_CLEANUP } from "pages/system/signedCommands";
import { cn } from "components/ui";
import { buildCommands, searchCommands } from "./commands";
import { OPEN_PALETTE_EVENT } from "./constants";

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * Groups an already-ranked command list into `{ group, items: [{ command, index }] }`
 * buckets in one pass — group order is first-seen order among the results,
 * items keep their relative rank within a group. Also returns the equivalent
 * flat, visually-ordered list (`flat`), since ArrowUp/ArrowDown and
 * `aria-activedescendant` need indices that match top-to-bottom DOM order,
 * not raw search-rank order.
 */
function groupResults(ranked) {
  const order = [];
  const byGroup = new Map();
  for (const command of ranked) {
    if (!byGroup.has(command.group)) {
      byGroup.set(command.group, []);
      order.push(command.group);
    }
    byGroup.get(command.group).push(command);
  }
  const flat = [];
  const groups = order.map(group => ({
    group,
    items: byGroup.get(group).map(command => {
      const index = flat.length;
      flat.push(command);
      return { command, index };
    }),
  }));
  return { groups, flat };
}

/**
 * ⌘K / Ctrl-K command palette over pages, installed apps, the DappStore
 * catalogue, help topics and maintenance actions. Opens on ⌘K / Ctrl-K, on
 * `/` (only when focus isn't already in a text field) and on the
 * `avado:open-palette` window event the top-bar Search button dispatches.
 * Renders nothing while closed.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const openerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useRef(`palette-listbox-${Math.random().toString(36).slice(2)}`).current;

  const history = useHistory();
  const dispatch = useDispatch();
  const packages = useSelector(getDnpInstalled) || [];
  const { storePackages } = useHealth();
  const { mode, setMode } = useMode();
  const { setPreference } = useTheme();

  const installedNames = useMemo(() => packages.map(p => p.name), [packages]);
  // `nav`: this mode's visible pages (same list SideBar.jsx shows). `advancedNav`:
  // whatever visibleNavItems additionally drops in Simple purely because of the
  // mode gate — still real commands (buildCommands marks them `restricted`),
  // findable on an exact label match. Diffed by reference: visibleNavItems only
  // filters `sidenavItems`, it never clones entries.
  const nav = useMemo(() => visibleNavItems(sidenavItems, { mode, installedNames }), [mode, installedNames]);
  const advancedNav = useMemo(() => {
    if (mode !== "simple") return [];
    const shown = new Set(nav);
    return visibleNavItems(sidenavItems, { mode: "advanced", installedNames }).filter(item => !shown.has(item));
  }, [mode, nav, installedNames]);
  const commands = useMemo(
    () => buildCommands({ nav, advancedNav, packages, storePackages, topics: TOPICS, mode }),
    [nav, advancedNav, packages, storePackages, mode]
  );
  const { groups: groupedForRender, flat: results } = useMemo(
    () => groupResults(searchCommands(commands, query)),
    [commands, query]
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && typeof opener.focus === "function") opener.focus();
  }, []);

  const openPalette = useCallback(() => {
    openerRef.current = document.activeElement;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  // Focus the input as soon as it mounts (i.e. whenever the palette opens).
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Lock page scroll while the palette is open, same as components/ui/Modal.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Reset the highlighted row whenever the visible result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, commands]);

  // Opened by the top-bar Search button.
  useEffect(() => {
    window.addEventListener(OPEN_PALETTE_EVENT, openPalette);
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, openPalette);
  }, [openPalette]);

  // Global keyboard shortcuts: ⌘K / Ctrl-K toggles, `/` opens (outside text
  // fields), Escape closes. Attached to `document` so it works regardless of
  // what currently has focus.
  useEffect(() => {
    function onKeyDown(e) {
      // Ctrl/Cmd+K only — no Shift/Alt. Without the Shift/Alt guard this also
      // matched Ctrl+Shift+K (Firefox's web console) and swallowed it.
      const isToggleCombo =
        (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k";
      if (isToggleCombo) {
        e.preventDefault();
        if (open) close();
        else openPalette();
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!open && e.key === "/" && !isTypingTarget(document.activeElement)) {
        e.preventDefault();
        openPalette();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close, openPalette]);

  const runCommand = useCallback(
    command => {
      if (!command) return;
      if (command.to) {
        close();
        history.push(command.to);
        return;
      }
      if (command.action) {
        const { type, id, value } = command.action;
        if (type === "restart") {
          close();
          confirmRestartPackage(id, restartId => dispatch(restartPackage(restartId)));
        } else if (type === "diskCleanup") {
          close();
          confirmSignedCmd(
            DISK_CLEANUP,
            { title: "Clean up disk", text: "Are you sure you want to perform a disk cleanup?" },
            (cmd, label) => dispatch(runSignedCmd(cmd, label)),
            "Disk cleanup"
          );
        } else if (type === "setMode") {
          close();
          setMode(value);
        } else if (type === "setTheme") {
          close();
          setPreference(value);
        }
      }
    },
    [close, history, dispatch, setMode, setPreference]
  );

  const onInputKeyDown = e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCommand(results[activeIndex]);
    }
  };

  if (!open) return null;

  const activeOptionId = results.length ? `${listboxId}-option-${activeIndex}` : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[5000] flex justify-center px-4 pt-[12vh]" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-bg/70 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 h-fit w-full max-w-xl animate-rise overflow-hidden rounded-xl bg-surface-raised text-fg shadow-xl dark:border dark:border-border">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <FiSearch className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-activedescendant={activeOptionId}
            aria-label="Search pages, apps, help topics and actions"
            autoComplete="off"
            spellCheck="false"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, apps, help topics and actions…"
            className="w-full min-w-0 bg-transparent py-3.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </div>

        <div id={listboxId} role="listbox" aria-label="Command results" className="max-h-[60vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">No matches. Try a different search.</p>
          ) : (
            groupedForRender.map(({ group, items }) => {
              const headingId = `${listboxId}-heading-${group}`;
              return (
                <div role="group" aria-labelledby={headingId} key={group}>
                  <div id={headingId} className="px-4 pb-1 pt-3 text-xs font-semibold tracking-wide text-fg-subtle">
                    {group}
                  </div>
                  {items.map(({ command, index }) => (
                    <div
                      key={command.id}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        "mx-2 flex cursor-pointer items-center rounded-md px-2.5 py-2 text-sm break-words",
                        index === activeIndex ? "bg-accent/10 text-fg" : "text-fg-muted hover:bg-surface-hover"
                      )}
                    >
                      {command.label}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
