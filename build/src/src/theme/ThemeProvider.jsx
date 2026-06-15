import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Theme system — single source of truth for the active theme.
 *
 *  - Applies `data-theme="dark|light"` on <html> (drives the CSS tokens).
 *  - Persists the user's choice to localStorage under "theme" (the key the
 *    legacy ThemeToggle already used — we integrate, not duplicate).
 *  - On first load, if the user never chose, follows `prefers-color-scheme`.
 *
 * `resolveInitialTheme()` is exported so index.jsx can paint the correct
 * theme synchronously before React mounts (avoids a flash).
 */

const STORAGE_KEY = "theme";
const THEMES = ["dark", "light"];

export function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) return stored;
  } catch (e) {
    /* localStorage may be unavailable (private mode) — fall through */
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark"; // AVADO default
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

const ThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);
  // Tracks whether the user has made an explicit choice (so we stop
  // following the OS once they do).
  const [hasUserChoice, setHasUserChoice] = useState(() => {
    try {
      return THEMES.includes(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return false;
    }
  });

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    setHasUserChoice(true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore persistence failures */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Keep <html data-theme> in sync with state.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS preference until the user explicitly picks a theme.
  useEffect(() => {
    if (hasUserChoice || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e) => setThemeState(e.matches ? "light" : "dark");
    mql.addEventListener
      ? mql.addEventListener("change", onChange)
      : mql.addListener(onChange);
    return () => {
      mql.removeEventListener
        ? mql.removeEventListener("change", onChange)
        : mql.removeListener(onChange);
    };
  }, [hasUserChoice]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
