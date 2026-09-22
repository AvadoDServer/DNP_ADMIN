import React from "react";
import { cn } from "./cn";

/**
 * Skeleton — shimmer placeholder for loading states.
 * Uses the .ui-skeleton utility defined in index.css.
 */
const Skeleton = ({ className, rounded = "md", ...props }) => {
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "lg"
      ? "rounded-lg"
      : rounded === "sm"
      ? "rounded-sm"
      : "rounded-md";
  return (
    <div
      aria-hidden="true"
      className={cn("ui-skeleton", radius, className)}
      {...props}
    />
  );
};

export default Skeleton;
