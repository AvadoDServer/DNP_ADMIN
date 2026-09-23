import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
// UI kit
import ProgressBar from "components/ui/ProgressBar";
import { cn } from "components/ui/cn";

// Utilities

function parseMessagesType(messages) {
  let globalType = "neutral";
  const messageTypes = messages
    .filter(message => !message.viewed)
    .map(message => message.type || "");
  if (messageTypes.includes("danger")) globalType = "danger";
  else if (messageTypes.includes("warning")) globalType = "warning";
  else if (messageTypes.includes("success")) globalType = "success";
  return globalType;
}

function areMessagesUnread(messages) {
  const unreadMessages = messages.filter(message => message && !message.viewed);
  return Boolean(unreadMessages.length);
}

// Trigger button size. "lg" (42px, 12px radius) matches the slimmed top
// bar's search button so both right-aligned controls line up (spec §4).
const SIZE = {
  md: "h-9 w-9 rounded-md",
  lg: "h-[42px] w-[42px] rounded-[12px]"
};

// Bubble color per status, token-driven.
const BUBBLE = {
  neutral: "",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger"
};

// Map legacy message "type" onto token text colors for titles.
const TITLE_COLOR = {
  danger: "text-danger-text",
  warning: "text-warning-text",
  success: "text-success-text"
};

function BaseDropdown({
  name,
  label,
  messages,
  Icon,
  onClick,
  className,
  placeholder,
  moreVisible,
  size = "md"
}) {
  const [collapsed, setCollapsed] = useState(true);
  const dropdownEl = useRef(null);

  function onToggle(e) {
    setCollapsed(!collapsed);
    if (typeof onClick === "function") onClick(e);
  }

  useEffect(() => {
    /**
     * As recommended in https://github.com/airbnb/react-outside-click-handler/blob/master/src/OutsideClickHandler.jsx
     * it is better to listen to mousedown, then subscribe to mouseup,
     * and then collpase the menu. This also helps with the case of
     * using the toggle to close the menu. This is why the ref is in
     * the general dropdown div, not in the dropdown menu.
     */
    if (collapsed) return; // Prevent unnecessary listeners
    function handleMouseUp(e) {
      document.removeEventListener("mouseup", handleMouseUp);
      if (!dropdownEl.current.contains(e.target)) setCollapsed(true);
    }
    function handleMouseDown(e) {
      if (!dropdownEl.current.contains(e.target))
        document.addEventListener("mouseup", handleMouseUp);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [collapsed]);

  if (!Array.isArray(messages)) {
    console.error("messages must be an array");
    return null;
  }

  // A message type can be "", ignore it
  const globalType = parseMessagesType(messages);
  const messagesAvailable = areMessagesUnread(messages);

  const attentionGrab = moreVisible && messagesAvailable;

  return (
    <div ref={dropdownEl} className={cn("relative", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={!collapsed}
        title={label || name}
        aria-label={label || name}
        className={cn(
          "relative flex items-center justify-center border border-border bg-surface text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg focus:outline-none focus-visible:shadow-focus",
          SIZE[size] || SIZE.md,
          label && "lg:w-auto lg:px-2.5",
          attentionGrab && "animate-pulse-soft text-fg"
        )}
      >
        <Icon />
        {label && <span className="topbar-label">{label}</span>}
        {BUBBLE[globalType] && (
          <span
            className={cn(
              "absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-bg",
              BUBBLE[globalType]
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {!collapsed && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[1100] mt-2 max-h-[30rem] w-[min(22.5rem,90vw)] overflow-y-auto rounded-lg border border-border bg-surface text-fg shadow-xl"
        >
          <div className="border-b border-border px-4 py-2.5 text-xs font-bold text-fg-subtle">
            {name}
          </div>
          {messages.map(({ type, title, body, progress, showProgress }, i) => (
            <div
              key={i}
              className="border-b border-border px-4 py-3 last:border-b-0"
            >
              {title ? (
                <div
                  className={cn(
                    "text-sm font-semibold",
                    TITLE_COLOR[type] || "text-fg"
                  )}
                >
                  {title}
                </div>
              ) : null}
              {body ? (
                <div className="mt-0.5 break-words text-sm text-fg-muted">
                  {body}
                </div>
              ) : null}
              {showProgress ? (
                <ProgressBar
                  className="mt-2"
                  size="sm"
                  variant={type === "danger" ? "danger" : "accent"}
                  value={Math.floor(100 * (progress || 0))}
                />
              ) : null}
            </div>
          ))}
          {!messages.length && placeholder && (
            <div className="px-4 py-3 text-sm text-fg-muted">{placeholder}</div>
          )}
        </div>
      )}
    </div>
  );
}

BaseDropdown.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  messages: PropTypes.array.isRequired,
  Icon: PropTypes.func.isRequired,
  onClick: PropTypes.func,
  offset: PropTypes.string,
  moreVisible: PropTypes.bool,
  size: PropTypes.oneOf(["md", "lg"])
};

export default BaseDropdown;
