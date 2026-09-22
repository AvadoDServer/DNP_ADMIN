import React from "react";
import { useTheme } from "theme/ThemeProvider";

const SunIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/**
 * App-wide theme toggle. Reads/writes the shared ThemeProvider context, so
 * a single instance keeps the whole app in sync. Persistence and OS-pref
 * handling live in the provider.
 */
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={!isDark}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg focus:outline-none focus-visible:shadow-focus"
    >
      <span className="relative block h-[18px] w-[18px]">
        <SunIcon
          className={`absolute inset-0 h-[18px] w-[18px] text-accent transition-all duration-300 ${
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <MoonIcon
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-300 ${
            isDark
              ? "rotate-90 scale-50 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
};

export default ThemeToggle;
