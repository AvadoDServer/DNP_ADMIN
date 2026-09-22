const STATES = {
  running: { key: "running", label: "Running", tone: "success" },
  exited: { key: "stopped", label: "Stopped", tone: "neutral" },
  created: { key: "stopped", label: "Stopped", tone: "neutral" },
  dead: { key: "crashed", label: "Crashed", tone: "danger" },
  restarting: { key: "restarting", label: "Restarting", tone: "warning" },
  paused: { key: "paused", label: "Paused", tone: "neutral" },
};

export function appStatus(pkg, { findings = [], updates = {} } = {}) {
  if (!pkg) return { key: "unknown", label: "Unknown", tone: "neutral" };
  const base = STATES[pkg.state] || { key: "unknown", label: pkg.state || "Unknown", tone: "neutral" };
  if (base.key !== "running") return base;
  if (findings.some(f => f.appId === pkg.name && f.topic === "setup" && f.severity !== "info"))
    return { key: "needs-setup", label: "Needs setup", tone: "warning" };
  if (updates[pkg.name]) return { key: "update", label: "Update available", tone: "accent" };
  return base;
}

// First-sentence match without a lookbehind (`(?<=\.)`), which Safari < 16.4
// does not support and throws a SyntaxError on. `(?=\s|$)` (a lookahead, not
// a lookbehind) is fine everywhere and gives the same result: everything up
// to and including the first period that is followed by whitespace or the
// end of the string.
const FIRST_SENTENCE = /^.*?\.(?=\s|$)/;

export function appDescription(pkg) {
  const m = (pkg && pkg.manifest) || {};
  const description = m.description || "";
  const firstSentence = description.match(FIRST_SENTENCE);
  const text = (m.shortDescription || (firstSentence ? firstSentence[0] : description) || "").trim();
  return text.length > 90 ? text.slice(0, 87).trimEnd() + "…" : text;
}
