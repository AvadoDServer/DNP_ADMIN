import React, { forwardRef } from "react";
import { cn } from "./cn";
import Spinner from "./Spinner";

/**
 * Button — token-driven, accessible.
 *
 * variant: primary | secondary | outline | ghost | danger | success
 * size:    sm | md | lg
 * loading: shows a spinner and disables interaction
 * pill:    fully rounded
 */
const VARIANTS = {
  primary:
    "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover active:bg-accent-active focus-visible:shadow-focus",
  secondary:
    "bg-surface text-fg border border-border hover:bg-surface-hover hover:border-border-strong focus-visible:shadow-focus",
  outline:
    "bg-transparent text-accent border border-accent/60 hover:bg-accent/10 hover:border-accent focus-visible:shadow-focus",
  ghost:
    "bg-transparent text-fg-muted hover:bg-fg/[0.06] hover:text-fg focus-visible:shadow-focus",
  danger:
    "bg-danger text-white shadow-sm hover:brightness-110 active:brightness-95 focus-visible:outline-danger",
  success:
    "bg-success text-white shadow-sm hover:brightness-110 active:brightness-95",
};

const SIZES = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

const Button = forwardRef(function Button(
  {
    as: Tag = "button",
    variant = "primary",
    size = "md",
    pill = false,
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className,
    children,
    type = "button",
    onClick,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  const isRealButton = Tag === "button";

  // A native `disabled` attribute is a no-op on a non-button element (e.g.
  // `as={Link}` renders an <a>, which stays focusable and clickable even
  // when `disabled` is set). For those, fall back to the ARIA-disabled
  // pattern: remove it from the tab order, mark it for assistive tech, and
  // swallow clicks instead of relying on the DOM attribute. Real buttons
  // keep the native `disabled` behaviour unchanged.
  const extraDisabledProps = !isRealButton && isDisabled ? { "aria-disabled": "true", tabIndex: -1 } : {};

  const handleClick = e => {
    if (!isRealButton && isDisabled) {
      e.preventDefault();
      return;
    }
    if (onClick) onClick(e);
  };

  return (
    <Tag
      ref={ref}
      {...(isRealButton ? { type, disabled: isDisabled } : {})}
      {...extraDisabledProps}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 focus:outline-none",
        pill ? "rounded-full" : "rounded-md",
        SIZES[size] || SIZES.md,
        VARIANTS[variant] || VARIANTS.primary,
        isDisabled && "pointer-events-none opacity-55",
        "active:translate-y-px",
        className
      )}
      {...props}
    >
      {loading && <Spinner size={size === "lg" ? "md" : "sm"} aria-hidden />}
      {!loading && leftIcon}
      {children != null && <span className={loading ? "opacity-90" : undefined}>{children}</span>}
      {!loading && rightIcon}
    </Tag>
  );
});

export default Button;
