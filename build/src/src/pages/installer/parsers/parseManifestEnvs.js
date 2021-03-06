/**
 * Parse the ENVs of a manifest object
 * @param {object} manifest
 * @returns {object} envs = {ENV_NAME: "ENV_VALUE"}
 */
export default function parseManifestEnvs(manifest = {}) {
  const envsArray = (manifest.image || {}).environment || [];
  return envsArray.reduce((obj, row) => {
    const [key, value] = (row || "").trim().split("=");
    obj[key] = value || "";
    return obj;
  }, {});
}
