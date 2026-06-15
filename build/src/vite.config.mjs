import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import fs from "fs";

// Absolute import roots used throughout the codebase (CRA NODE_PATH=src / jsconfig baseUrl=src).
// Each top-level folder under src/ is importable without a relative prefix, e.g. `import x from "utils/x"`.
// Derive them from the actual directory listing so no root is ever missed.
const srcDir = path.resolve(__dirname, "src");
const srcAliasRoots = fs
  .readdirSync(srcDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

export default defineConfig(({ mode }) => {
  // Load every env var (including REACT_APP_* and the legacy NODE_PATH) from .env files.
  // The third arg "" means "do not filter by prefix" so we can see all vars.
  const env = loadEnv(mode, process.cwd(), "");

  // Build the static replacement map so existing `process.env.REACT_APP_*` references
  // (the codebase predates import.meta.env) keep resolving at build time, exactly like CRA did.
  // CRA injected REACT_APP_* vars from BOTH .env files and the shell environment, so we merge
  // both here (shell wins). This is what makes `REACT_APP_MOCK_DATA=true yarn dev` actually take
  // the mock-data branch in index.jsx instead of falling through to the live WAMP connection.
  const mergedEnv = { ...env };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("REACT_APP_") && value !== undefined) mergedEnv[key] = value;
  }

  const processEnvDefine = {
    "process.env.NODE_ENV": JSON.stringify(mode === "development" ? "development" : "production"),
    "process.env.PUBLIC_URL": JSON.stringify(""),
  };
  for (const [key, value] of Object.entries(mergedEnv)) {
    if (key.startsWith("REACT_APP_")) {
      processEnvDefine[`process.env.${key}`] = JSON.stringify(value);
    }
  }
  // NOTE: vite-plugin-node-polyfills clears the user `define` map in dev (it
  // injects a real `process`), so `process.env.*` / custom defines do NOT resolve
  // during `vite dev`. Anything needed at the synchronous top level in dev (the
  // mock-data gate, version stamps) therefore reads `import.meta.env.REACT_APP_*`,
  // which is handled by Vite core and is unaffected by the polyfill. The dev-only
  // mock flag lives in `.env.development`.

  return {
    // Vite root is build/src (where this config + index.html live).
    root: __dirname,
    // Serve static files (favicons, manifest.json, etc.) from public/ as CRA did.
    publicDir: path.resolve(__dirname, "public"),
    // Match CRA's REACT_APP_ prefix for any future import.meta.env usage.
    envPrefix: "REACT_APP_",
    plugins: [
      react(),
      // web3 / autobahn-browser / ethereum-* expect Node globals (Buffer, process, global, stream).
      nodePolyfills({
        globals: { Buffer: true, global: true, process: true },
        protocolImports: true,
      }),
    ],
    define: processEnvDefine,
    resolve: {
      // For each top-level src/ folder produce two aliases:
      //   `^root/...`  -> src/root/...   (subpath imports)
      //   `^root$`     -> src/root       (bare imports that resolve to src/root/index.js)
      alias: srcAliasRoots.flatMap((root) => [
        {
          find: new RegExp(`^${root}/`),
          replacement: path.join(srcDir, root) + "/",
        },
        {
          find: new RegExp(`^${root}$`),
          replacement: path.join(srcDir, root),
        },
      ]),
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Silence noisy deprecation warnings from bootstrap 4 / dependencies.
          quietDeps: true,
        },
      },
    },
    server: {
      port: 3000,
      open: false,
    },
    preview: {
      port: 3000,
    },
    build: {
      // CRA outputs to build/ (Dockerfile copies /usr/src/app/build to nginx). Keep that.
      outDir: "build",
      emptyOutDir: true,
    },
  };
});
