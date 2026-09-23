import React, { forwardRef } from "react";
import { cn } from "./cn";

/**
 * Card — the canonical surface container.
 *
 * interactive: adds hover lift + accent border + pointer (for clickable cards)
 * padding:     none | sm | md | lg
 * as:          override the rendered element (default div)
 */
const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

const Card = forwardRef(function Card(
  {
    as: Tag = "div",
    interactive = false,
    padding = "md",
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={cn(
        // Appliance panels: radius 20, no border in light (a 1px bottom
        // "shelf" shadow stands in for it), a hairline border in dark.
        "relative rounded-xl bg-surface text-fg shadow-[0_1px_0_rgb(var(--border))] transition-all duration-200 dark:border dark:border-border dark:shadow-none",
        PADDING[padding] ?? PADDING.md,
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md dark:hover:border-accent/60 focus-visible:shadow-focus focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
});

export const CardHeader = ({ className, children, ...props }) => (
  <div
    className={cn(
      "mb-4 flex items-start justify-between gap-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }) => (
  <h3
    className={cn("text-base font-semibold leading-tight text-fg", className)}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({ className, children, ...props }) => (
  <p className={cn("mt-1 text-sm text-fg-muted", className)} {...props}>
    {children}
  </p>
);

export default Card;
