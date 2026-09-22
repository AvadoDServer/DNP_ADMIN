import { isTabPath, TAB_PATHS } from "../SystemTabs";

describe("isTabPath", () => {
  it("matches every tab path exactly", () => {
    for (const p of TAB_PATHS) expect(isTabPath(p)).toBe(true);
  });

  it("matches case-insensitively, since the <Route>s underneath aren't `sensitive` either", () => {
    expect(isTabPath("/system/Updates")).toBe(true);
    expect(isTabPath("/SYSTEM/STORAGE")).toBe(true);
    expect(isTabPath("/System")).toBe(true);
  });

  it("is false for a path that isn't one of the four tab pages", () => {
    expect(isTabPath("/system/update")).toBe(false);
    expect(isTabPath("/system/some-core-app.dnp.dappnode.eth")).toBe(false);
    expect(isTabPath(undefined)).toBe(false);
    expect(isTabPath(null)).toBe(false);
  });
});
