import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Simple/Advanced mode — single source of truth for which mode the owner is
 * currently in.
 *
 *  - Persists the choice to localStorage under "avado.mode" (default
 *    "simple" — see spec §5).
 *  - Modelled after theme/ThemeProvider.jsx: a non-throwing default context
 *    value, so any component can call `useMode()` without requiring a
 *    `<ModeProvider>` ancestor (tests, Storybook-style usage, etc.).
 */

const STORAGE_KEY = "avado.mode";
const MODES = ["simple", "advanced"];
const DEFAULT_MODE = "simple";

function resolveInitialMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(stored)) return stored;
  } catch (e) {
    /* localStorage may be unavailable (private mode) or blocked — fall through */
  }
  return DEFAULT_MODE;
}

const ModeContext = createContext({
  mode: DEFAULT_MODE,
  isAdvanced: false,
  setMode: () => {},
  toggleMode: () => {},
});

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(resolveInitialMode);

  const setMode = useCallback(next => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore persistence failures — the choice still holds for this session */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "advanced" ? "simple" : "advanced");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, isAdvanced: mode === "advanced", setMode, toggleMode }),
    [mode, setMode, toggleMode]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}

export default ModeProvider;
