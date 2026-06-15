import { render } from "react-dom";
import { Provider } from "react-redux";
// ##### TODO: Investigate if HashRouter is really required
import { HashRouter as Router } from "react-router-dom";

import { cleanObj } from "utils/objects";
import api from "./API";
import App from "./App";
import store from "./store";

// Init css
import "react-toastify/dist/ReactToastify.css";
// Boostrap loaders
import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import * as $ from "jquery";
import Popper from "popper.js";
import Tether from "tether";
import "./avado_styles.css";
import "./dappnode_colors.css";
import "./dappnode_styles.css";
import "./layout.css";
import "./theme.css";

// Initialize boostrap dependencies
window.jQuery = window.$ = $;
window.Tether = Tether;
window.Popper = Popper;

// Set default theme on load
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

/**
 * `yarn dev` REACT_APP_MOCK_DATA = true
 * - Loads a mock state from ./mockState
 * - Dispatches an action to replace the entire state
 * `yarn start` / [Production] REACT_APP_MOCK_DATA = false
 * - Starts the api, subscribing to WAMP
 */
if (process.env.REACT_APP_MOCK_DATA) {
  import("./mockState")
    .then(({ mockState }) =>
      store.dispatch({ type: "DEV_ONLY_REPLACE_STATE", state: mockState })
    )
    .catch((e) => console.log(`Error loading mockContent: ${e.stack}`));
} else {
  api.start();
}

// This process.env. vars will be substituted at build time
// The REACT_APP_ prefix is mandatory for the substitution to work
window.versionData = cleanObj({
  version: process.env.REACT_APP_VERSION,
  branch: process.env.REACT_APP_BRANCH,
  commit: process.env.REACT_APP_COMMIT,
});

render(
  <Provider store={store}>
    <Router>
      <App />
    </Router>
  </Provider>,
  document.getElementById("root")
);
