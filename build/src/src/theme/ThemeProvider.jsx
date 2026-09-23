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
 *  - `preference` is what the owner picked: "light", "dark", or "system"
 *    (the default — no explicit choice made yet). It persists to
 *    localStorage under "theme" (the key the legacy ThemeToggle already
 *    used — we integrate, not duplicate); "system" is represented by the
 *    ABSENCE of that key, not the literal string, so a stale/foreign value
 *    never gets stuck.
 *  - `theme` is the resolved value ("light"/"dark") actually painted —
 *    equal to `preference` when explicit, or the live OS preference when
 *    `preference === "system"`.
 *
 * `resolveInitialTheme()` is exported so index.jsx can paint the correct
 * theme synchronously before React mounts (avoids a flash).
 */

const STORAGE_KEY = "theme";
const THEMES = ["dark", "light"];
const PREFERENCES = ["dark", "light", "system"];

/** The owner's explicit choice ("dark"/"light"), or "system" if unset. */
export function resolvePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) return stored;
  } catch (e) {
    /* localStorage may be unavailable (private mode) — fall through */
  }
  return "system";
}

/** What the OS currently prefers, used whenever preference is "system". */
export function resolveSystemTheme() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark"; // AVADO default
}

export function resolveInitialTheme() {
  const preference = resolvePreference();
  return preference === "system" ? resolveSystemTheme() : preference;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

const ThemeContext = createContext({
  theme: "dark",
  preference: "system",
  setPreference: () => {},
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(resolvePreference);
  const [theme, setThemeState] = useState(resolveInitialTheme);

  const setPreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return;
    setPreferenceState(next);
    if (next === "system") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        /* ignore persistence failures */
      }
      setThemeState(resolveSystemTheme());
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        /* ignore persistence failures */
      }
      setThemeState(next);
    }
  }, []);

  // Legacy API kept for existing callers (ThemeToggle, AppPage): choosing an
  // explicit theme is the same as choosing that preference.
  const setTheme = useCallback(
    (next) => {
      if (!THEMES.includes(next)) return;
      setPreference(next);
    },
    [setPreference]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Keep <html data-theme> in sync with the resolved theme.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // While preference is "system", follow the OS live.
  useEffect(() => {
    if (preference !== "system" || !window.matchMedia) return;
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
  }, [preference]);

  const value = useMemo(
    () => ({ theme, preference, setPreference, setTheme, toggleTheme }),
    [theme, preference, setPreference, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
