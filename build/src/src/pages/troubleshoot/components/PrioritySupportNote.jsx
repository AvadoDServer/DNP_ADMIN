import React from "react";
import { Link } from "react-router-dom";

/** Shared by HelpHome and HelpTopic's "Still stuck?" section — a plain link
 * to Priority, never a call to the priority API from here. */
export default function PrioritySupportNote() {
  return (
    <p className="mt-4 text-sm text-fg-muted">
      Priority support subscribers get faster answers — manage it in{" "}
      <Link to="/priority" className="font-medium text-accent hover:underline">
        Priority
      </Link>
      .
    </p>
  );
}
