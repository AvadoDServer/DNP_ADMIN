import { feeRecipientMissing, FEE_RECIPIENT_STEPS } from "health/rules/validators";
import { updateBlocked, UPDATE_BLOCKED_AFTER_MS } from "health/rules/updates";
import { runChecksDetailed } from "health/engine";
import { ALL_RULES } from "health/rules";
import { pkg, snapshot } from "./fixtures";

const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
const ADDRESS_RE = /0x[0-9a-f]{8,}/i;

describe("feeRecipientMissing", () => {
  it("is critical when a client has loaded validators without a fee recipient", () => {
    const s = snapshot({
      packages: [pkg(NIMBUS, { manifest: { title: "Nimbus" } })],
      feeRecipients: { [NIMBUS]: { validators: 4, checked: 4, missing: 2 } },
    });
    const [f] = feeRecipientMissing(s);
    expect(f).toMatchObject({ id: `fee-recipient-missing:${NIMBUS}`, severity: "critical", appId: NIMBUS });
    expect(f.title).toBe("Validators in Nimbus have no fee recipient");
    expect(f.title).not.toMatch(ADDRESS_RE);
    expect(f.detail).toBe("2 validators without a fee recipient");
    expect(f.steps).toEqual(FEE_RECIPIENT_STEPS);
    expect(FEE_RECIPIENT_STEPS).toHaveLength(3);
  });
  it("no finding without validators, when all are set, or when the client could not be read", () => {
    expect(feeRecipientMissing(snapshot({ feeRecipients: { [NIMBUS]: { validators: 0, checked: 0, missing: 0 } } }))).toEqual([]);
    expect(feeRecipientMissing(snapshot({ feeRecipients: { [NIMBUS]: { validators: 3, checked: 3, missing: 0 } } }))).toEqual([]);
    expect(feeRecipientMissing(snapshot({ feeRecipients: {} }))).toEqual([]);
  });
  it("is skipped (not counted as passed) when fee recipients are unknown", () => {
    const withData = runChecksDetailed(snapshot({ feeRecipients: {}, updateAges: {} }), ALL_RULES).total;
    const without = runChecksDetailed(snapshot({ feeRecipients: null, updateAges: null }), ALL_RULES).total;
    expect(withData - without).toBe(2);
  });
});

describe("updateBlocked", () => {
  const NOW = 1790103551 * 1000;
  const updates = { [NIMBUS]: { from: "0.0.50", to: "0.0.51", hash: "/ipfs/Qm1" } };
  it("is critical when an auto-updated package has waited 48 h", () => {
    const s = snapshot({ packages: [pkg(NIMBUS, { manifest: { title: "Nimbus", autoupdate: true } })], updates, updateAges: { [NIMBUS]: NOW - UPDATE_BLOCKED_AFTER_MS }, now: NOW });
    const [f] = updateBlocked(s);
    expect(f).toMatchObject({ id: `update-blocked:${NIMBUS}`, severity: "critical", topic: "updates", title: "Nimbus can't update" });
    expect(f.detail).toBe("Installed 0.0.50, available 0.0.51");
    // Plain version numbers: FindingRow shows them in Simple mode too.
    expect(f.detailInSimple).toBe(true);
  });
  it("is a warning when the owner turned automatic updates off", () => {
    const s = snapshot({ packages: [pkg(NIMBUS, { manifest: { title: "Nimbus", autoupdate: false } })], updates, updateAges: { [NIMBUS]: NOW - UPDATE_BLOCKED_AFTER_MS - 1 }, now: NOW });
    expect(updateBlocked(s)[0]).toMatchObject({ severity: "warning" });
  });
  it("the core's manifest.autoupdate wins over a stale top-level flag", () => {
    const ages = { [NIMBUS]: NOW - UPDATE_BLOCKED_AFTER_MS };
    const on = pkg(NIMBUS, { autoupdate: false, manifest: { title: "Nimbus", autoupdate: true } });
    expect(updateBlocked(snapshot({ packages: [on], updates, updateAges: ages, now: NOW }))[0].severity).toBe("critical");
    const off = pkg(NIMBUS, { autoupdate: true, manifest: { title: "Nimbus", autoupdate: false } });
    expect(updateBlocked(snapshot({ packages: [off], updates, updateAges: ages, now: NOW }))[0].severity).toBe("warning");
  });
  it("nothing before 48 h, nothing without a pending update, nothing without ages", () => {
    expect(updateBlocked(snapshot({ packages: [pkg(NIMBUS)], updates, updateAges: { [NIMBUS]: NOW - UPDATE_BLOCKED_AFTER_MS + 60000 }, now: NOW }))).toEqual([]);
    expect(updateBlocked(snapshot({ packages: [pkg(NIMBUS)], updates: {}, updateAges: { [NIMBUS]: 0 }, now: NOW }))).toEqual([]);
    expect(updateBlocked(snapshot({ packages: [pkg(NIMBUS)], updates, updateAges: {}, now: NOW }))).toEqual([]);
  });
});
