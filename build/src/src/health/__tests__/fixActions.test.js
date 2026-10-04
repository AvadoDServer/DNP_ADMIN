import { runFixAction } from "health/fixActions";
import { togglePackage, restartPackage, resetBeaconData } from "pages/packages/actions";
import confirmResetBeaconData from "pages/packages/components/confirmResetBeaconData";

vi.mock("pages/packages/components/confirmResetBeaconData", () => ({ default: vi.fn() }));
vi.mock("pages/packages/actions", () => ({
  resetBeaconData: vi.fn(id => ({ __thunk: "resetBeaconData", id })),
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
    resetBeaconData.mockClear();
    confirmResetBeaconData.mockClear();
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
    runFixAction({ fix: { kind: "action", action: "restartPackage" } }, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does nothing for fix.action "startPackage" (removed: it could stop a running container)', () => {
    const finding = { fix: { kind: "action", action: "startPackage" }, appId };
    runFixAction(finding, dispatch);
    expect(togglePackage).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
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

  describe("resetBeaconData", () => {
    const teku = "teku.avado.dnp.dappnode.eth";
    const finding = { fix: { kind: "action", action: "resetBeaconData" }, appId: teku };
    const packages = [{ name: "nimbus.avado.dnp.dappnode.eth" }, { name: teku, volumes: [] }];

    it("opens the confirm for the package and dispatches nothing yet", () => {
      runFixAction(finding, dispatch, packages);
      expect(confirmResetBeaconData).toHaveBeenCalledTimes(1);
      expect(confirmResetBeaconData).toHaveBeenCalledWith(packages[1], expect.any(Function));
      expect(dispatch).not.toHaveBeenCalled();
      expect(resetBeaconData).not.toHaveBeenCalled();
    });

    it("dispatches resetBeaconData(id) only when the confirm calls back", () => {
      runFixAction(finding, dispatch, packages);
      confirmResetBeaconData.mock.calls[0][1](teku);
      expect(resetBeaconData).toHaveBeenCalledWith(teku);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(resetBeaconData.mock.results[0].value);
    });

    it("does nothing for an unknown appId or without packages", () => {
      runFixAction({ ...finding, appId: "gone.avado.dnp.dappnode.eth" }, dispatch, packages);
      runFixAction(finding, dispatch, []);
      runFixAction(finding, dispatch);
      expect(confirmResetBeaconData).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
