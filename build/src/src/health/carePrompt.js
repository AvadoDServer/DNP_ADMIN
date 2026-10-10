// The Priority Care prompt on Home. Admin only: AVADO Care does not vendor
// this file.
//
// When the box has a real problem and the owner does not run AVADO Care (the
// app Priority Care subscribers get), Home offers the subscription once, in
// one muted line under the findings (components/health/CarePrompt.jsx):
// Priority Care would have sent an email about exactly this.
//
// Whether the owner subscribes is not asked here: Home makes no call to the
// Priority Care backend. An installed AVADO Care app stands in for it.
import { CARE_PACKAGE } from "./careFindings";

// The findings that count as "a real problem": the part of a finding id
// before the ":" (ids are `kind` or `kind:package`, see health/rules/).
//  - an app is stopped or keeps restarting, or a core app is down (rules/apps.js)
//  - the disk is nearly full or filling up (rules/storage.js)
//  - a chain client can't be reached, is behind the chain, or its validators
//    miss attestations (rules/chain.js)
// Everything else (updates, setup tips, router and access notes, a client
// that is simply syncing, few peers) is not an emergency and gets no prompt.
export const CARE_PROMPT_KINDS = [
  "app-stopped",
  "app-restarting",
  "core-app-down",
  "disk-high",
  "disk-filling-up",
  "chain-error",
  "head-behind",
  "missed-attestations",
];
// All of the above are raised as one of these; "info" never prompts.
const PROBLEM_SEVERITIES = ["critical", "warning"];

export const CARE_PROMPT_HIDE_DAYS = 30;
const HIDE_MS = CARE_PROMPT_HIDE_DAYS * 24 * 60 * 60 * 1000;
const KEY = "avado.carePromptHiddenUntil";

/** The finding is one of the real problems listed above. */
export function isCarePromptFinding(finding) {
  if (!finding || typeof finding.id !== "string") return false;
  return CARE_PROMPT_KINDS.includes(finding.id.split(":")[0]) && PROBLEM_SEVERITIES.includes(finding.severity);
}

/**
 * Show the prompt: there is a real problem right now, AVADO Care is not
 * installed, and the owner did not answer "Not now" in the last 30 days.
 *
 * @param {Array} findings the findings Home lists
 * @param {Array} packages installed packages
 * @param {number} now ms
 * @param {number|null} hiddenUntil ms, from readCarePromptHiddenUntil
 */
export function showCarePrompt({ findings, packages, now = Date.now(), hiddenUntil = null } = {}) {
  if (!(findings || []).some(isCarePromptFinding)) return false;
  if ((packages || []).some(p => p && p.name === CARE_PACKAGE)) return false;
  // "Not now" never hides for more than 30 days, so a date further away
  // than that (a clock that was wrong on the day) does not hide it for good.
  const hidden = typeof hiddenUntil === "number" && hiddenUntil > now && hiddenUntil <= now + HIDE_MS;
  return !hidden;
}

/** Until when "Not now" hides the prompt (ms); null when it was never asked. */
export function readCarePromptHiddenUntil() {
  try {
    const until = Number(localStorage.getItem(KEY));
    return Number.isFinite(until) && until > 0 ? until : null;
  } catch (e) {
    return null;
  }
}

/** "Not now": hide the prompt for 30 days. Returns until when (ms). */
export function hideCarePrompt(now = Date.now()) {
  const until = now + HIDE_MS;
  try {
    localStorage.setItem(KEY, String(until));
  } catch (e) {
    // Private mode or blocked storage: the prompt is back after a reload.
  }
  return until;
}
