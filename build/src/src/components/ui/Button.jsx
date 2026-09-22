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
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <Tag
      ref={ref}
      {...(Tag === "button" ? { type } : {})}
      disabled={isDisabled}
      aria-busy={loading || undefined}
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
