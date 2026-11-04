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
 * @param {object} manifest
 * @returns {array} [{ id, env, title, description, secret, required }]
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
    out.push({
      id: String(field.id || env),
      env,
      title: String(field.title || env),
      description: typeof field.description === "string" ? field.description : "",
      secret: field.secret === true,
      required: field.required === true
    });
  }
  return out;
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
