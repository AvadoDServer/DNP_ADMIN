import { runChecks, runChecksDetailed, verdictOf } from "health/engine";

const f = (id, severity, topic = "core") => ({ id, severity, topic, title: id, why: "", fix: null });

describe("runChecks", () => {
  it("flattens, drops nulls and sorts by severity then topic", () => {
    const rules = [
      () => f("info-a", "info", "access"),
      () => null,
      () => [f("warn-b", "warning", "storage"), f("crit-c", "critical", "sync")],
      () => f("warn-a", "warning", "setup"),
    ];
    expect(runChecks({}, rules).map(x => x.id)).toEqual(["crit-c", "warn-a", "warn-b", "info-a"]);
  });

  it("isolates a rule that throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rules = [() => { throw Error("boom"); }, () => f("ok", "info")];
    expect(runChecks({}, rules).map(x => x.id)).toEqual(["ok"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("runChecksDetailed", () => {
  it("counts rules that return null or [] as passed, a throwing rule as neither", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rules = [
      () => null,
      () => [],
      () => f("crit", "critical"),
      () => {
        throw Error("boom");
      },
    ];
    const { findings, passed, total } = runChecksDetailed({}, rules);
    expect(findings.map(x => x.id)).toEqual(["crit"]);
    expect(passed).toBe(2);
    expect(total).toBe(4);
    spy.mockRestore();
  });

  it("runChecks delegates to runChecksDetailed and returns only the findings", () => {
    const rules = [() => null, () => f("ok", "info")];
    expect(runChecks({}, rules)).toEqual(runChecksDetailed({}, rules).findings);
  });

  it("skips a rule.needs === 'metrics' rule entirely (not counted as passed) when snapshot.metrics is null", () => {
    const needsMetrics = () => [];
    needsMetrics.needs = "metrics";
    const rules = [needsMetrics, () => null];

    const withoutMetrics = runChecksDetailed({ metrics: null }, rules);
    expect(withoutMetrics.total).toBe(1);
    expect(withoutMetrics.passed).toBe(1);

    const withMetrics = runChecksDetailed({ metrics: { headSlot: [] } }, rules);
    expect(withMetrics.total).toBe(2);
    expect(withMetrics.passed).toBe(2);
  });

  it("still runs and counts a rule.needs === 'metrics' rule once metrics produce a finding", () => {
    const needsMetrics = () => f("needs-metrics", "warning");
    needsMetrics.needs = "metrics";
    const { findings, total, passed } = runChecksDetailed({ metrics: { ok: true } }, [needsMetrics]);
    expect(findings.map(x => x.id)).toEqual(["needs-metrics"]);
    expect(total).toBe(1);
    expect(passed).toBe(0);
  });
});

describe("verdictOf", () => {
  it("is critical when any finding is critical", () => {
    expect(verdictOf([f("a", "info"), f("b", "critical")])).toEqual({ level: "critical", label: "Action required" });
  });
  it("is warning when the worst is a warning", () => {
    expect(verdictOf([f("a", "warning")])).toEqual({ level: "warning", label: "Needs attention" });
  });
  it("is ok with only info findings or none", () => {
    expect(verdictOf([f("a", "info")])).toEqual({ level: "ok", label: "All good" });
    expect(verdictOf([])).toEqual({ level: "ok", label: "All good" });
  });
});
