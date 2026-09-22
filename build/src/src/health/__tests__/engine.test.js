import { runChecks, verdictOf } from "health/engine";

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
