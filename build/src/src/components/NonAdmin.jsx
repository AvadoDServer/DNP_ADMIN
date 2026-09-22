import React from "react";

const NonAdmin = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 py-20 text-center text-fg">
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/12 text-warning">
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    </span>
    <h1 className="text-3xl font-bold tracking-tight text-fg">
      Snap! You are not an admin
    </h1>
    <p className="max-w-md text-sm leading-relaxed text-fg-muted">
      This website is reserved for the AVADO's administrator. Your VPN profile
      must have admin privileges.
    </p>
  </div>
);

export default NonAdmin;
