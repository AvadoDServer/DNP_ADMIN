// Findings the Admin cannot compute in the browser but AVADO Care computes on
// the box. Today that is only the fee-recipient check: the validator packages'
// CORS lists leave out http://my.ava.do (see health/feeRecipients.js), while
// Care reads them server side. Care's GET /api/status (read through the
// Admin's /care-api/status proxy, pages/priority/careApi.js) lists its
// findings as { id, severity, topic, title, why }.

import { FEE_RECIPIENT_STEPS } from "./rules/validators";

export const CARE_PACKAGE = "care.avado.dnp.dappnode.eth";
// Same addresses as pages/priority/careApi.js CARE_STATUS_URLS (not imported:
// that module pulls in the whole Priority page and its API client).
export const CARE_STATUS_URLS = ["/care-api/status", "http://care.my.ava.do/api/status"];
const TIMEOUT_MS = 8000;
export const CARE_FINDING_PREFIXES = ["fee-recipient-missing:"];
// The written "How to fix it" steps for each allowed prefix. Care's status has
// none, so they come from the Admin's own rule for the same finding.
const CARE_STEPS = { "fee-recipient-missing:": FEE_RECIPIENT_STEPS };
export const CARE_SOURCE_NOTE = "Checked by AVADO Care.";

const ID = /^fee-recipient-missing:[a-z0-9.-]{1,120}$/;
const SEVERITIES = new Set(["critical", "warning"]);
// One finding per validator client at most; a bound keeps a garbled status from flooding the list
export const MAX_CARE_FINDINGS = 10;

/** Care's findings with an allowed prefix, as Admin findings; [] for anything unexpected. */
export function careFindingsFromStatus(status) {
  const list = status && Array.isArray(status.findings) ? status.findings : [];
  const out = [];
  for (const f of list) {
    if (out.length >= MAX_CARE_FINDINGS) break;
    if (!f || typeof f.id !== "string" || !ID.test(f.id)) continue;
    const prefix = CARE_FINDING_PREFIXES.find(p => f.id.startsWith(p));
    if (!prefix) continue;
    if (!SEVERITIES.has(f.severity) || typeof f.title !== "string" || !f.title) continue;
    if (out.some(o => o.id === f.id)) continue;
    const appId = f.id.slice(f.id.indexOf(":") + 1);
    const why = typeof f.why === "string" && f.why ? `${f.why} ` : "";
    out.push({
      id: f.id,
      severity: f.severity,
      topic: typeof f.topic === "string" && f.topic ? f.topic : "setup",
      appId,
      title: f.title.slice(0, 200),
      why: `${why}${CARE_SOURCE_NOTE}`.trim(),
      source: "care",
      fix: { kind: "link", to: `/packages/${appId}`, label: "Open the app" },
      ...(CARE_STEPS[prefix] ? { steps: CARE_STEPS[prefix] } : {}),
    });
  }
  return out;
}

/** Adds Care's findings that the Admin's own list does not have (by id). */
export function mergeCareFindings(findings, careFindings) {
  const have = new Set((findings || []).map(f => f.id));
  const extra = (careFindings || []).filter(f => !have.has(f.id));
  return extra.length ? [...findings, ...extra] : findings;
}

/** Care's /api/status, through the Admin's same-origin proxy first; throws when neither answers. */
export async function fetchCareStatus(fetchImpl = fetch) {
  for (const url of CARE_STATUS_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = await res.json(); // the SPA fallback (index.html) is not JSON and lands in catch
      if (data && typeof data === "object") return data;
    } catch (e) {
      // try the next address
    } finally {
      clearTimeout(timer);
    }
  }
  throw Error("AVADO Care is not answering");
}
