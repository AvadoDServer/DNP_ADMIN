import { appStatus, appDescription } from "components/appStatus";

const p = (state, extra = {}) => ({ name: "nimbus.avado.dnp.dappnode.eth", state, running: state === "running", ...extra });

describe("appStatus", () => {
  it("maps docker states", () => {
    expect(appStatus(p("running"), {}).key).toBe("running");
    expect(appStatus(p("exited"), {}).key).toBe("stopped");
    expect(appStatus(p("dead"), {}).key).toBe("crashed");
    expect(appStatus(p("restarting"), {}).key).toBe("restarting");
    expect(appStatus(p("paused"), {}).key).toBe("paused");
    expect(appStatus(p("weird"), {}).key).toBe("unknown");
  });
  it("prefers needs-setup, then update, over running", () => {
    const findings = [{ appId: "nimbus.avado.dnp.dappnode.eth", topic: "setup", severity: "critical" }];
    expect(appStatus(p("running"), { findings }).key).toBe("needs-setup");
    expect(appStatus(p("running"), { updates: { "nimbus.avado.dnp.dappnode.eth": { to: "2" } } })).toMatchObject({ key: "update", label: "Update available" });
  });
});

describe("appDescription", () => {
  it("uses shortDescription, else the first sentence of description", () => {
    expect(appDescription({ manifest: { shortDescription: "Beacon chain and validator" } })).toBe("Beacon chain and validator");
    expect(appDescription({ manifest: { description: "Grafana dashboards for your AVADO. Installing it also installs Prometheus." } })).toBe("Grafana dashboards for your AVADO.");
    expect(appDescription({})).toBe("");
  });

  it("returns the whole description unchanged when it has no sentence-ending period", () => {
    expect(appDescription({ manifest: { description: "Grafana dashboards for your AVADO" } })).toBe("Grafana dashboards for your AVADO");
    expect(appDescription({ manifest: { description: "v1.2.3 client image" } })).toBe("v1.2.3 client image");
  });
});
