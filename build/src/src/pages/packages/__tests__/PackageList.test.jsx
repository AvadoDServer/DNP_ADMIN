import { getAutoUpdateState } from "pages/packages/components/PackageList";

describe("getAutoUpdateState", () => {
  it("reads the package's own flag, not the manifest's", () => {
    expect(getAutoUpdateState({ autoupdate: false, manifest: { autoupdate: true } })).toBe(false);
    expect(getAutoUpdateState({ autoupdate: true, manifest: { autoupdate: false } })).toBe(true);
  });
});
