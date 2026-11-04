/**
 * Userset env values in a logged call (installPackage kwargs) replaced with
 * "********", so typed secrets are not kept in the Admin's activity list.
 * @param {object} log userActionLog
 * @returns {object}
 */
export default function hideUserSetEnvs(log) {
  const envs = log && log.kwargs && log.kwargs.userSetEnvs;
  if (!envs || typeof envs !== "object") return log;
  const hidden = {};
  for (const [dnpName, values] of Object.entries(envs)) {
    hidden[dnpName] = {};
    for (const key of Object.keys(values || {})) hidden[dnpName][key] = "********";
  }
  return { ...log, kwargs: { ...log.kwargs, userSetEnvs: hidden } };
}
