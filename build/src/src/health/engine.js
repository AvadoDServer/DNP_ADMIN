export const SEVERITIES = ["critical", "warning", "info"];
export const TOPICS = ["setup", "sync", "attestations", "updates", "access", "storage", "core"];

const rank = (list, value) => {
  const i = list.indexOf(value);
  return i === -1 ? list.length : i;
};

/**
 * Run every rule over the snapshot. A rule returns a finding, an array of
 * findings, or null. One failing rule must never hide the others.
 */
export function runChecks(snapshot, rules) {
  const findings = [];
  for (const rule of rules) {
    try {
      const out = rule(snapshot);
      if (Array.isArray(out)) findings.push(...out.filter(Boolean));
      else if (out) findings.push(out);
    } catch (e) {
      console.error(`Health rule ${rule.name || "(anonymous)"} failed`, e);
    }
  }
  return findings.sort(
    (a, b) =>
      rank(SEVERITIES, a.severity) - rank(SEVERITIES, b.severity) ||
      rank(TOPICS, a.topic) - rank(TOPICS, b.topic) ||
      String(a.title).localeCompare(String(b.title))
  );
}

export function verdictOf(findings) {
  if (findings.some(f => f.severity === "critical")) return { level: "critical", label: "Action required" };
  if (findings.some(f => f.severity === "warning")) return { level: "warning", label: "Needs attention" };
  return { level: "ok", label: "All good" };
}
