/**
 * Parses url params into an object
 * Sample params:
 * - timeapp.public.dappnode.eth
 * - 0.1.16
 * - /ipfs/QmSDgpiHco5yXdyVTfhKxr3aiJ82ynz8V14QcGKicM3rVh
 * @param {string} params
 * @returns {object}
 */
export const parseUrlQuery = (params = "") =>
  params.split("&").reduce((obj, pair) => {
    const [key, value] = pair.split("=");
    obj[key] = decodeURIComponent(value);
    return obj;
  }, {});

/**
 * Reverse of parseUrlQuery, such that:
 *   params = stringifyUrlQuery(parseUrlQuery(params))
 * @param {object} obj
 * @returns {string} params
 */
export const stringifyUrlQuery = obj =>
  Object.keys(obj)
    .map(key => `${key}=${encodeURIComponent(obj[key])}`)
    .join("&");
