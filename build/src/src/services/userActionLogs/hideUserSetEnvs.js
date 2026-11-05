function hideValues(values) {
  const hidden = {};
  for (const key of Object.keys(values || {})) hidden[key] = "********";
  return hidden;
}

/**
 * Env values in a logged call replaced with "********", so typed settings and
 * secrets are not kept in the Admin's activity list:
 * - installPackage's userSetEnvs { dnpName: { ENV: value } } (installer fields)
 * - updatePackageEnv's envs { ENV: value } (app Settings)
 * @param {object} log userActionLog
 * @returns {object}
 */
export default function hideUserSetEnvs(log) {
  const kwargs = log && log.kwargs;
  if (!kwargs || typeof kwargs !== "object") return log;
  const { userSetEnvs, envs } = kwargs;
  const hideInstall = userSetEnvs && typeof userSetEnvs === "object";
  const hideSettings = envs && typeof envs === "object";
  if (!hideInstall && !hideSettings) return log;
  const out = { ...kwargs };
  if (hideInstall) {
    out.userSetEnvs = {};
    for (const [dnpName, values] of Object.entries(userSetEnvs)) out.userSetEnvs[dnpName] = hideValues(values);
  }
  if (hideSettings) out.envs = hideValues(envs);
  return { ...log, kwargs: out };
}
