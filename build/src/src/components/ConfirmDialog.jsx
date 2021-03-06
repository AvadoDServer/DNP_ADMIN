import React, { useRef } from "react";
import PropTypes from "prop-types";
import Button from "components/Button";
import { render, unmountComponentAtNode } from "react-dom";
import "./confirmDialog.css";

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
  function handleClickOverlay(e) {
    if (modalEl.current === e.target) close();
  }

  // Add a button from the shorthand form
  if (label && onClick) buttons.push({ label, onClick });

  // If there is no "Cancel" option, add it as the first
  if (!buttons.find(({ label }) => (label || "").includes("Cancel")))
    buttons.unshift({ label: "Cancel", variant: "outline-secondary" });

  return (
    <div
      className="confirm-dialog-root"
      ref={modalEl}
      onClick={handleClickOverlay}
    >
      <div className="dialog">
        {title && <h3 className="title">{title}</h3>}
        {text && <div className="text">{text}</div>}
        <div className="buttons">
          {buttons.map(({ label, variant, onClick }) => (
            <Button
              key={label}
              variant={variant || "outline-danger"}
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
