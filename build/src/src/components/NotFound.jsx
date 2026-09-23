import React from "react";
import { Link } from "react-router-dom";
import Card from "components/ui/Card";
import Button from "components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center animate-fade-in">
      <Card padding="lg" className="flex w-full flex-col items-center gap-4">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <div>
          <h1 className="mb-0 font-display text-2xl font-bold text-fg">Page not found</h1>
          <p className="mb-0 mt-2 text-sm text-fg-muted">This address doesn't match a page in your AVADO.</p>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button as={Link} to="/dashboard" variant="primary" size="sm">Go to Home</Button>
          <Button as={Link} to="/help" variant="secondary" size="sm">Get help</Button>
        </div>
      </Card>
    </div>
  );
}
