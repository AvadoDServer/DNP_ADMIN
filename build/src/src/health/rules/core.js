const SKIP = new Set(["getDiagnoseDiskSpace", "getDiagnoseCoreDnpsRunning"]);

export function diagnoseFailed({ diagnoses }) {
  return (diagnoses || [])
    .filter(d => d && !d.loading && d.ok === false && !SKIP.has(d.id))
    .map(d => ({
      id: `diagnose:${d.id}`,
      severity: "warning",
      topic: "core",
      title: d.msg,
      why: "A built-in system check failed. The steps below usually fix it.",
      fix: { kind: "steps", label: "How to fix it" },
      steps: d.solutions || [],
    }));
}
