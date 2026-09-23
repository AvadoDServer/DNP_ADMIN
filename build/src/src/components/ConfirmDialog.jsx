import React, { useRef } from "react";
import PropTypes from "prop-types";
import Button from "components/ui/Button";
import { render, unmountComponentAtNode } from "react-dom";

/**
 * Render a dialog modal
 *
 * @param {string} title Important action
 * @param {string} text Are you sure you want to do this?
 * @param {array} buttons = [{
 *   label: "Cancel",
 *   onClick: () => null
 * },{
 *   label: "Confirm",
 *   onClick: () => doImportantAction()
 * }, ... ]
 */
function Modal({ title, text, buttons = [], label, onClick, close }) {
  // If user clicks the modal itself, do not close
  const modalEl = useRef(null);
  const titleId = useRef(`confirm-dialog-title-${Math.random().toString(36).slice(2)}`).current;
  function handleClickOverlay(e) {
    if (modalEl.current === e.target) close();
  }

  // Add a button from the shorthand form
  if (label && onClick) buttons.push({ label, onClick });

  // If there is no "Cancel" option, add it as the first
  if (!buttons.find(({ label }) => (label || "").includes("Cancel")))
    buttons.unshift({ label: "Cancel", variant: "secondary" });

  return (
    <div
      ref={modalEl}
      onClick={handleClickOverlay}
      className="fixed inset-0 z-[5000] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 animate-fade-in bg-[rgb(var(--bg-inset)/0.72)] backdrop-blur-sm" />
      {/* Appliance panel: radius 20, no border in light (the elevation
          shadow carries it), a hairline border in dark. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="relative max-h-[80vh] w-full max-w-md animate-rise overflow-y-auto rounded-xl bg-surface-raised text-fg shadow-xl dark:border dark:border-border"
      >
        <div className="px-6 py-5">
          {title && (
            <h3 id={titleId} className="mb-0 text-lg font-semibold text-fg">
              {title}
            </h3>
          )}
          {text && <div className="mt-2 whitespace-pre-line text-sm text-fg-muted">{text}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-4">
          {buttons.map(({ label, variant, onClick }) => (
            <Button
              key={label}
              variant={variant === "secondary" ? "secondary" : "danger"}
              pill
              onClick={() => {
                if (onClick) onClick();
                close();
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  label: PropTypes.string,
  onClick: PropTypes.func,
  buttons: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      variant: PropTypes.string,
      onClick: PropTypes.func
    }).isRequired
  )
};

// If multiple dialogs are used within a single session,
// the root-modal DOM node will be reused
let root;
export function confirm(props) {
  if (!root) {
    // Create the root-modal element
    root = document.createElement("div");
    document.body.appendChild(root);
  }
  // render (or re-render) and mount the dialog
  render(<Modal {...props} close={() => unmountComponentAtNode(root)} />, root);
}
