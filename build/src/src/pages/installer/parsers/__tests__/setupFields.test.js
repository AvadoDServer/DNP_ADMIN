import {
  getSetupFields,
  dropEmptyEnvs,
  currentEnvs,
  changedSettings,
  missingRequired,
  switchValue,
  isSwitchOn
} from "pages/installer/parsers/setupFields";
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
        required: false,
        kind: "secret",
        options: []
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
    expect(fields).toEqual([{ id: "c", env: "C", title: "C", description: "", secret: false, required: false, kind: "text", options: [] }]);
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

describe("getSetupFields: field kinds (DAppNode enum)", () => {
  const field = (extra) => getSetupFields({ setupWizard: { fields: [{ id: "X", target: { type: "environment", name: "X" }, ...extra }] } })[0];

  it("a true/false enum is a switch, in any spelling", () => {
    expect(field({ enum: ["true", "false"] })).toMatchObject({ kind: "boolean", options: ["true", "false"] });
    expect(field({ enum: ["False", "True"] })).toMatchObject({ kind: "boolean" });
    expect(field({ enum: [true, false] })).toMatchObject({ kind: "boolean", options: ["true", "false"] });
  });

  it("any other enum is a drop-down, without repeats", () => {
    expect(field({ enum: ["eng", "deu", "slv", "eng"] })).toMatchObject({ kind: "select", options: ["eng", "deu", "slv"] });
    expect(field({ enum: ["true", "false", "auto"] })).toMatchObject({ kind: "select" });
  });

  it("a secret is always a masked text box", () => {
    expect(field({ secret: true, enum: ["a", "b"] })).toMatchObject({ kind: "secret", options: [] });
  });

  it("an empty or broken enum is a text box", () => {
    expect(field({ enum: [] })).toMatchObject({ kind: "text" });
    expect(field({ enum: "a,b" })).toMatchObject({ kind: "text" });
    expect(field({ enum: [{}, null] })).toMatchObject({ kind: "text" });
  });

  it("switch values keep the package's spelling", () => {
    const f = field({ enum: ["TRUE", "FALSE"] });
    expect(switchValue(f, true)).toBe("TRUE");
    expect(switchValue(f, false)).toBe("FALSE");
    expect(isSwitchOn("True")).toBe(true);
    expect(isSwitchOn(" true ")).toBe(true);
    expect(isSwitchOn("false")).toBe(false);
    expect(isSwitchOn(undefined)).toBe(false);
  });
});

describe("Settings form helpers", () => {
  const fields = getSetupFields({
    setupWizard: {
      fields: [
        { id: "k", target: { type: "environment", name: "KEY" }, title: "Key", secret: true },
        { id: "s", target: { type: "environment", name: "SIGNUPS" }, title: "Sign-ups", enum: ["true", "false"] },
        { id: "l", target: { type: "environment", name: "LANG" }, title: "Language", enum: ["eng", "deu"], required: true }
      ]
    }
  });

  it("current values: manifest defaults, then the package's .env", () => {
    const dnp = { manifest: { image: { environment: ["SIGNUPS=true", "LANG=eng", "KEY="] } }, envs: { LANG: "deu", KEY: "old" } };
    expect(currentEnvs(dnp)).toEqual({ SIGNUPS: "true", LANG: "deu", KEY: "old" });
    expect(currentEnvs({})).toEqual({});
    expect(currentEnvs(undefined)).toEqual({});
  });

  it("sends only what changed; an empty secret keeps the current one", () => {
    const current = { KEY: "old", SIGNUPS: "true", LANG: "eng" };
    expect(changedSettings(fields, { KEY: "", SIGNUPS: "true", LANG: "eng" }, current)).toEqual({});
    expect(changedSettings(fields, { KEY: "", SIGNUPS: "false", LANG: "eng" }, current)).toEqual({ SIGNUPS: "false" });
    expect(changedSettings(fields, { KEY: "  new  ", SIGNUPS: "true", LANG: "deu" }, current)).toEqual({ KEY: "new", LANG: "deu" });
    // the same secret typed again is still sent (it is never shown, so it cannot be compared on the page)
    expect(changedSettings(fields, { KEY: "old" }, current)).toEqual({ KEY: "old" });
    expect(changedSettings(fields, {}, current)).toEqual({});
  });

  it("required fields: an empty drop-down blocks; a secret that is already set does not", () => {
    const req = getSetupFields({
      setupWizard: {
        fields: [
          { id: "k", target: { type: "environment", name: "KEY" }, title: "Key", secret: true, required: true },
          { id: "n", target: { type: "environment", name: "NAME" }, title: "Name", required: true }
        ]
      }
    });
    expect(missingRequired(req, { KEY: "", NAME: "x" }, { KEY: "set", NAME: "x" })).toEqual([]);
    expect(missingRequired(req, { KEY: "", NAME: " " }, { KEY: "", NAME: "x" }).map(f => f.env)).toEqual(["KEY", "NAME"]);
    expect(missingRequired(fields, { LANG: "" }, { LANG: "eng" }).map(f => f.env)).toEqual(["LANG"]);
    expect(missingRequired(fields, {}, { LANG: "eng" })).toEqual([]);
  });
});
