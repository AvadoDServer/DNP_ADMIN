import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

/**
 * Modal / Dialog — token-driven, accessible.
 *  - Renders into document.body via a portal.
 *  - Closes on Escape and backdrop click (unless disabled).
 *  - Locks body scroll and moves focus into the dialog while open.
 *  - role="dialog" + aria-modal + aria-labelledby wiring.
 */
const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  className,
}) => {
  const panelRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

  const handleKey = useCallback(
    (e) => {
      if (e.key === "Escape") onClose && onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog for screen-reader / keyboard users.
    const t = setTimeout(() => panelRef.current && panelRef.current.focus(), 0);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, handleKey]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center p-4"
      aria-hidden={false}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-[rgb(var(--bg-inset)/0.72)] backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          // Appliance panels floating on the backdrop: radius 20, no border
          // in light (the elevation shadow carries it), a hairline border
          // in dark.
          "relative w-full animate-rise rounded-xl bg-surface-raised text-fg shadow-xl focus:outline-none dark:border dark:border-border",
          SIZES[size] || SIZES.md,
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              {title && (
                <h2 id={titleId} className="text-lg font-semibold text-fg">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-fg-muted">{description}</p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-2 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-fg/[0.06] hover:text-fg focus:outline-none focus-visible:shadow-focus"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
