import parseManifestEnvs from "./parseManifestEnvs";

/**
 * Setup fields a package asks for before it is installed.
 *
 * Same field format as DAppNode's setup-wizard.yml (version 2), carried in
 * the manifest as `setupWizard`:
 *   "setupWizard": {
 *     "version": "2",
 *     "fields": [{
 *       "id": "TS_AUTHKEY",
 *       "target": { "type": "environment", "name": "TS_AUTHKEY" },
 *       "title": "Tailscale auth key",
 *       "description": "One line of help, [links](https://...) allowed",
 *       "secret": true,
 *       "required": false
 *     }]
 *   }
 * Only `environment` targets are shown; the value goes to the install call as
 * userSetEnvs[packageName][target.name]. Other targets are left out.
 *
 * DAppNode's `enum` (a list of allowed values) becomes a drop-down, or an
 * on/off switch when the two values are "true" and "false". A secret field is
 * always a masked text box, even with an enum.
 *
 * @param {object} manifest
 * @returns {array} [{ id, env, title, description, secret, required, kind, options }]
 *   kind: "text" | "secret" | "select" | "boolean"
 */
export function getSetupFields(manifest) {
  const fields = ((manifest || {}).setupWizard || {}).fields;
  if (!Array.isArray(fields)) return [];
  const seen = new Set();
  const out = [];
  for (const field of fields) {
    if (!field || typeof field !== "object") continue;
    const target = field.target || {};
    const env = target.type === "environment" && target.name;
    if (typeof env !== "string" || !env || seen.has(env)) continue;
    seen.add(env);
    const secret = field.secret === true;
    const options = secret ? [] : enumOptions(field.enum);
    out.push({
      id: String(field.id || env),
      env,
      title: String(field.title || env),
      description: typeof field.description === "string" ? field.description : "",
      secret,
      required: field.required === true,
      kind: secret ? "secret" : !options.length ? "text" : isOnOff(options) ? "boolean" : "select",
      options
    });
  }
  return out;
}

function enumOptions(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const v of values)
    if ((typeof v === "string" || typeof v === "number" || typeof v === "boolean") && !out.includes(String(v))) out.push(String(v));
  return out;
}

function isOnOff(options) {
  return options.length === 2 && options.some(o => /^true$/i.test(o)) && options.some(o => /^false$/i.test(o));
}

/**
 * The value an on/off switch stores, in the spelling the package declared.
 * @param {object} field with kind "boolean"
 * @param {boolean} on
 */
export function switchValue(field, on) {
  return field.options.find(o => (on ? /^true$/i : /^false$/i).test(o));
}

export function isSwitchOn(value) {
  return /^true$/i.test(String(value || "").trim());
}

/**
 * The settings a package runs with now: the manifest defaults, overridden by
 * the package's .env file (what listPackages returns as dnp.envs).
 * @param {object} dnp installed package
 * @returns {object} { ENV: "value" }
 */
export function currentEnvs(dnp) {
  return { ...parseManifestEnvs((dnp && dnp.manifest) || {}), ...((dnp && dnp.envs) || {}) };
}

/**
 * What the Settings form changes, to send to updatePackageEnv: only fields
 * whose value differs from the current one (the DAPPMANAGER keeps the rest).
 * A secret field is never pre-filled, so an empty secret means "keep it".
 * Values are trimmed.
 * @param {array} fields getSetupFields
 * @param {object} typed { ENV: value } what the form holds
 * @param {object} current currentEnvs(dnp)
 * @returns {object} { ENV: "new value" }
 */
export function changedSettings(fields, typed, current) {
  const out = {};
  for (const field of fields) {
    const raw = (typed || {})[field.env];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (field.secret) {
      if (value) out[field.env] = value;
    } else if (value !== String((current || {})[field.env] ?? "").trim()) out[field.env] = value;
  }
  return out;
}

/**
 * Required fields the form would leave empty (a secret that already has a
 * value counts as filled).
 * @returns {array} fields
 */
export function missingRequired(fields, typed, current) {
  return fields.filter(field => {
    if (!field.required) return false;
    const typedValue = String((typed || {})[field.env] ?? "").trim();
    if (field.secret) return !typedValue && !String((current || {})[field.env] ?? "").trim();
    const value = (typed || {})[field.env] !== undefined ? typedValue : String((current || {})[field.env] ?? "").trim();
    return !value;
  });
}

/**
 * Leave out empty values, so an empty field keeps the package's own default.
 * @param {object} userSetEnvs { dnpName: { ENV: "value" } }
 * @returns {object}
 */
export function dropEmptyEnvs(userSetEnvs) {
  const out = {};
  for (const [dnpName, envs] of Object.entries(userSetEnvs || {})) {
    const kept = {};
    for (const [key, value] of Object.entries(envs || {}))
      if (value !== "" && value !== undefined && value !== null) kept[key] = value;
    if (Object.keys(kept).length) out[dnpName] = kept;
  }
  return out;
}
