import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
// ##### TODO: Investigate if HashRouter is really required
import { HashRouter as Router } from "react-router-dom";

import { cleanObj } from "utils/objects";
import api from "./API";
import App from "./App";
import store from "./store";
import ThemeProvider, {
  applyTheme,
  resolveInitialTheme
} from "./theme/ThemeProvider";

// Bundled fonts (replaces the Google Fonts @import in index.css)
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/sen/600.css";
import "@fontsource/sen/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

// Init css
import "react-toastify/dist/ReactToastify.css";
// Boostrap loaders (kept for not-yet-migrated pages)
import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import * as $ from "jquery";
import Popper from "popper.js";
import Tether from "tether";
// Design tokens first, then Tailwind base/utilities, then legacy overrides.
import "./theme.css";
import "./index.css";
import "./avado_styles.css";
import "./dappnode_colors.css";
import "./dappnode_styles.css";
import "./layout.css";

// Initialize boostrap dependencies
window.jQuery = window.$ = $;
window.Tether = Tether;
window.Popper = Popper;

// Paint the correct theme synchronously before React mounts (no flash).
// The ThemeProvider then owns it for the rest of the app's lifetime.
applyTheme(resolveInitialTheme());

/**
 * `yarn dev` REACT_APP_MOCK_DATA = true
 * - Loads a mock state from ./mockState
 * - Dispatches an action to replace the entire state
 * `yarn start` / [Production] REACT_APP_MOCK_DATA = false
 * - Starts the api, subscribing to WAMP
 */
// import.meta.env.REACT_APP_MOCK_DATA is "true" in dev (from .env.development)
// and undefined in production builds — see vite.config.mjs.
if (import.meta.env.REACT_APP_MOCK_DATA) {
  import("./mockState")
    .then(({ mockState }) =>
      store.dispatch({ type: "DEV_ONLY_REPLACE_STATE", state: mockState })
    )
    .catch((e) => console.log(`Error loading mockContent: ${e.stack}`));
} else {
  api.start();
}

// Statically inlined by Vite from REACT_APP_* env (getVersionData.sh writes
// .env.production at build time; empty in dev).
window.versionData = cleanObj({
  version: import.meta.env.REACT_APP_VERSION,
  branch: import.meta.env.REACT_APP_BRANCH,
  commit: import.meta.env.REACT_APP_COMMIT,
});

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <Provider store={store}>
    <ThemeProvider>
      <Router>
        <App />
      </Router>
    </ThemeProvider>
  </Provider>
);
