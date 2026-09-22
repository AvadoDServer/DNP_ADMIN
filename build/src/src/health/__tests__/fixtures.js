export const pkg = (name, overrides = {}) => ({
  name,
  id: name,
  state: "running",
  running: true,
  isCore: false,
  version: "1.0.0",
  volumes: [],
  manifest: { name, title: name.split(".")[0], version: "1.0.0" },
  ...overrides,
});

export const snapshot = (overrides = {}) => ({
  packages: [],
  stats: {},
  params: {},
  diagnoses: [],
  chainData: [],
  updates: {},
  coreUpdate: { available: false },
  metrics: null,
  sources: { updates: "ok", metrics: "not-installed" },
  now: 1790103551 * 1000,
  ...overrides,
});
