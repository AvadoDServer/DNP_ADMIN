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

  it("accepts a predicate as rule.needs and skips the rule (not counted) while it returns false", () => {
    const rule = vi.fn(() => []);
    rule.needs = s => Boolean(s.metrics && s.metrics.peers);
    const other = () => null;

    const skipped = runChecksDetailed({ metrics: { peers: null, headSlot: [] } }, [rule, other]);
    expect(rule).not.toHaveBeenCalled();
    expect(skipped.total).toBe(1);
    expect(skipped.passed).toBe(1);

    const ran = runChecksDetailed({ metrics: { peers: [] } }, [rule, other]);
    expect(rule).toHaveBeenCalledTimes(1);
    expect(ran.total).toBe(2);
    expect(ran.passed).toBe(2);
  });

  it("a predicate rule.needs that holds lets the rule report findings", () => {
    const rule = () => f("low-peers:x", "warning");
    rule.needs = () => true;
    const { findings, total, passed } = runChecksDetailed({}, [rule]);
    expect(findings.map(x => x.id)).toEqual(["low-peers:x"]);
    expect(total).toBe(1);
    expect(passed).toBe(0);
  });

  it("a predicate rule.needs that throws skips the rule instead of breaking the run", () => {
    const rule = vi.fn(() => f("never", "critical"));
    rule.needs = s => s.metrics.peers.length > 0; // metrics is null here
    const { findings, total, passed } = runChecksDetailed({ metrics: null }, [rule, () => null]);
    expect(rule).not.toHaveBeenCalled();
    expect(findings).toEqual([]);
    expect(total).toBe(1);
    expect(passed).toBe(1);
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
