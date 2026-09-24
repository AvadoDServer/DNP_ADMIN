import React from "react";

export default function Notice({ variant, children }) {
  const styles = {
    danger: "border-danger/40 bg-danger-subtle text-danger-text",
    warning: "border-warning/50 bg-warning/10 text-fg",
    success: "border-success/40 bg-success-subtle text-success-text",
    neutral: "border-border bg-bg-subtle text-fg-muted"
  };
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${styles[variant] || styles.neutral}`}
    >
      {children}
    </div>
  );
}
