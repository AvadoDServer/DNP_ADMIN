import { getSetupFields, dropEmptyEnvs } from "pages/installer/parsers/setupFields";
import { getUserSetFormatted } from "pages/installer/selectors";
import { mountPoint } from "pages/installer/data";

// Same field definition as DAppNode's setup-wizard.yml (version 2)
const tailscale = {
  name: "tailscale.avado.dnp.dappnode.eth",
  setupWizard: {
    version: "2",
    fields: [
      {
        id: "TS_AUTHKEY",
        target: { type: "environment", name: "TS_AUTHKEY", service: "tailscale" },
        title: "Tailscale auth key",
        description: "Make a key [here](https://login.tailscale.com/admin/settings/keys).",
        secret: true,
        required: false
      }
    ]
  }
};

describe("getSetupFields", () => {
  it("reads DAppNode's setupWizard environment fields", () => {
    expect(getSetupFields(tailscale)).toEqual([
      {
        id: "TS_AUTHKEY",
        env: "TS_AUTHKEY",
        title: "Tailscale auth key",
        description: "Make a key [here](https://login.tailscale.com/admin/settings/keys).",
        secret: true,
        required: false
      }
    ]);
  });

  it("returns nothing for packages without fields", () => {
    expect(getSetupFields({ name: "x" })).toEqual([]);
    expect(getSetupFields(undefined)).toEqual([]);
    expect(getSetupFields({ setupWizard: {} })).toEqual([]);
    expect(getSetupFields({ setupWizard: { fields: "nope" } })).toEqual([]);
  });

  it("leaves out other targets, form-only questions and repeats; optional unless required: true", () => {
    const fields = getSetupFields({
      setupWizard: {
        fields: [
          { id: "a", title: "Port", target: { type: "portMapping", containerPort: "80" } },
          { id: "b", title: "Question without target" },
          { id: "c", target: { type: "environment", name: "C" }, required: "yes" },
          { id: "c2", target: { type: "environment", name: "C" }, title: "again" },
          null
        ]
      }
    });
    expect(fields).toEqual([{ id: "c", env: "C", title: "C", description: "", secret: false, required: false }]);
  });
});

describe("dropEmptyEnvs / getUserSetFormatted", () => {
  it("keeps typed values and drops empty ones", () => {
    expect(dropEmptyEnvs({ a: { X: "1", Y: "" }, b: { Z: "" } })).toEqual({ a: { X: "1" } });
    expect(dropEmptyEnvs({})).toEqual({});
  });

  it("sends only filled values to installPackage", () => {
    const state = {
      [mountPoint]: { userSetEnvs: { [tailscale.name]: { TS_AUTHKEY: "tskey-auth-1", OTHER: "" } }, userSetPorts: {}, userSetVols: {} }
    };
    expect(getUserSetFormatted(state).userSetEnvs).toEqual({ [tailscale.name]: { TS_AUTHKEY: "tskey-auth-1" } });
  });

  it("is unchanged for an install without fields", () => {
    const state = { [mountPoint]: { userSetEnvs: {}, userSetPorts: {}, userSetVols: {} } };
    expect(getUserSetFormatted(state)).toEqual({ userSetEnvs: {}, userSetPorts: {}, userSetVols: {} });
  });
});
