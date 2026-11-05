/**
 * Copy text to the clipboard. navigator.clipboard only exists on https (and
 * localhost); the Admin is served over plain http, so fall back to a hidden
 * textarea and execCommand("copy").
 * @param {string} text
 * @returns {Promise<void>} rejects when the browser refused
 */
export default async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(area);
  }
  if (!copied) throw Error("The browser did not copy");
}
