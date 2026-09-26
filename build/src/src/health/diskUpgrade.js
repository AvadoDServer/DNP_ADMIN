// The 4 TB disk upgrade kit from the AVADO shop. Admin only: AVADO Care does
// not vendor this file.
//
// The kit replaces the 2 TB disk of the i7 AVADO (Intel i7-10710U, the
// i7-232) with a 4 TB one; the shop and the docs FAQ say it "is incompatible
// with other AVADO devices", and the i7-432 already has 4 TB. So it is only
// offered to a box that is:
//  - an i7-10710U (getStats cpuName),
//  - with a disk of 2.1 "TB" or less (getStats diskTotal is 1024-based but
//    labelled "TB": a 2 TB disk shows "1.82 TB"),
//  - and short of space: 75 % full, or full within 60 days by the forecast.
// Both stats arrived with core 10.0.47; a box without them gets no offer.
import { parsePercent } from "./rules/storage";

export const KIT_URL = "https://www.ava.do/shop/4tb-disk-upgrade/";
export const KIT_PRICE = "€700";
// System > Storage, with the kit card brought into view.
export const KIT_PATH = "/system/storage?kit=1";
export const KIT_DISK_PCT = 75;
export const KIT_FORECAST_DAYS = 60;
const KIT_CPU = /i7-10710U/i;
const KIT_MAX_DISK_TB = 2.1;

/** getStats' "1.82 TB" as a number (1.82); null when missing or unreadable. */
export function parseDiskTotalTb(value) {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*TB$/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The kit fits this box: an i7-10710U with the 2 TB disk. */
export function kitFits(stats) {
  const cpu = stats && typeof stats.cpuName === "string" ? stats.cpuName : "";
  const tb = parseDiskTotalTb(stats && stats.diskTotal);
  return KIT_CPU.test(cpu) && tb !== null && tb <= KIT_MAX_DISK_TB;
}

/** Offer the kit: it fits, and the disk is 75 % full or full within 60 days (see diskForecast). */
export function showKitOffer(stats, forecast) {
  if (!kitFits(stats)) return false;
  const pct = parsePercent(stats && stats.disk);
  const soon = Boolean(forecast && forecast.state === "filling" && forecast.days < KIT_FORECAST_DAYS);
  return (pct !== null && pct >= KIT_DISK_PCT) || soon;
}

// Findings about disk space that get a "Get more space" link.
const DISK_FINDINGS = ["disk-high", "disk-filling-up"];

/**
 * "Get more space" for a disk finding on a box the kit fits: a link to the
 * kit card on System > Storage, not straight to the shop, so the owner reads
 * what the move involves (backing up keys, syncing again) before buying.
 */
export function kitFindingLink(finding, stats, forecast) {
  if (!finding || !DISK_FINDINGS.includes(finding.id) || !showKitOffer(stats, forecast)) return null;
  return { kind: "link", to: KIT_PATH, label: "Get more space" };
}
