import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-fg">Page not found</h1>
      <p className="mt-2 text-fg-muted">This address doesn't match a page in your AVADO.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/dashboard" className="font-medium text-accent hover:underline">Go to Home</Link>
        <Link to="/help" className="font-medium text-accent hover:underline">Get help</Link>
      </div>
    </div>
  );
}
