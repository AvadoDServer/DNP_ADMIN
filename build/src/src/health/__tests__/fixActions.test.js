import { runFixAction } from "health/fixActions";
import { togglePackage, restartPackage } from "pages/packages/actions";

vi.mock("pages/packages/actions", () => ({
  togglePackage: vi.fn(id => ({ __thunk: "toggle", id })),
  restartPackage: vi.fn(id => ({ __thunk: "restart", id })),
}));

const appId = "nimbus.avado.dnp.dappnode.eth";

describe("runFixAction", () => {
  let dispatch;

  beforeEach(() => {
    dispatch = vi.fn();
    togglePackage.mockClear();
    restartPackage.mockClear();
  });

  it("does nothing when finding is null or undefined", () => {
    runFixAction(null, dispatch);
    runFixAction(undefined, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does nothing when fix.kind is not "action"', () => {
    runFixAction({ fix: { kind: "link", to: "/system" }, appId }, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing when appId is missing", () => {
    runFixAction({ fix: { kind: "action", action: "startPackage" } }, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches the thunk from togglePackage(appId) for fix.action "startPackage"', () => {
    const finding = { fix: { kind: "action", action: "startPackage" }, appId };
    runFixAction(finding, dispatch);
    expect(togglePackage).toHaveBeenCalledWith(appId);
    expect(restartPackage).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(togglePackage.mock.results[0].value);
  });

  it('dispatches restartPackage(appId) for fix.action "restartPackage"', () => {
    const finding = { fix: { kind: "action", action: "restartPackage" }, appId };
    runFixAction(finding, dispatch);
    expect(restartPackage).toHaveBeenCalledWith(appId);
    expect(togglePackage).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(restartPackage.mock.results[0].value);
  });

  it("does nothing for an unrecognised fix.action", () => {
    runFixAction({ fix: { kind: "action", action: "resyncPackage" }, appId }, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
