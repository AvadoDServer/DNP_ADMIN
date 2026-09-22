import { wizardUrl, tabsFor } from "pages/packages/components/AppPage";

describe("app page helpers", () => {
  it("finds the wizard URL", () => {
    expect(wizardUrl({ name: "nimbus.avado.dnp.dappnode.eth", manifest: { links: { OnboardingWizard: "http://nimbus.my.ava.do" } } }, "dark")).toBe("http://nimbus.my.ava.do");
    expect(wizardUrl({ name: "remoteconnect.avado.dnp.dappnode.eth", manifest: {} }, "light")).toBe("http://remoteconnect.my.ava.do/?theme=light");
    expect(wizardUrl({ name: "x", manifest: {} }, "dark")).toBeNull();
  });
  it("only offers Setup when there is a wizard, and defaults to it", () => {
    expect(tabsFor(true).map(t => t.id)).toEqual(["setup", "overview", "logs", "settings", "files"]);
    expect(tabsFor(false).map(t => t.id)).toEqual(["overview", "logs", "settings", "files"]);
  });
});
