import { careFindingsFromStatus, mergeCareFindings, CARE_SOURCE_NOTE } from "health/careFindings";

const NIMBUS = "nimbus.avado.dnp.dappnode.eth";
const careFee = {
  id: `fee-recipient-missing:${NIMBUS}`,
  severity: "critical",
  topic: "setup",
  title: "Validators in Nimbus have no fee recipient",
  why: "When a validator proposes a block, the block's transaction fees go to its fee recipient.",
};

describe("careFindingsFromStatus", () => {
  it("takes only fee-recipient findings, with a source note and a link to the app", () => {
    const out = careFindingsFromStatus({
      findings: [careFee, { id: "disk-high", severity: "critical", topic: "storage", title: "Your disk is 93% full", why: "" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: careFee.id,
      severity: "critical",
      appId: NIMBUS,
      title: careFee.title,
      source: "care",
      fix: { kind: "link", to: `/packages/${NIMBUS}` },
    });
    expect(out[0].why.endsWith(CARE_SOURCE_NOTE)).toBe(true);
  });

  it("ignores anything unexpected", () => {
    expect(careFindingsFromStatus(null)).toEqual([]);
    expect(careFindingsFromStatus({ findings: "x" })).toEqual([]);
    expect(careFindingsFromStatus({ findings: [{ ...careFee, severity: "info" }] })).toEqual([]);
    expect(careFindingsFromStatus({ findings: [{ ...careFee, id: "fee-recipient-missing:<script>" }] })).toEqual([]);
    expect(careFindingsFromStatus({ findings: [{ ...careFee, title: "" }] })).toEqual([]);
  });
});

describe("mergeCareFindings", () => {
  it("adds Care's findings the Admin does not have, by id", () => {
    const own = [{ id: "disk-high" }, { id: careFee.id, title: "own" }];
    const merged = mergeCareFindings(own, careFindingsFromStatus({ findings: [careFee] }));
    expect(merged).toBe(own);
    const merged2 = mergeCareFindings([{ id: "disk-high" }], careFindingsFromStatus({ findings: [careFee] }));
    expect(merged2.map(f => f.id)).toEqual(["disk-high", careFee.id]);
  });
});

describe("fetchCareStatus", () => {
  it("tries the Admin's proxy first, then the package's own address", async () => {
    const { fetchCareStatus } = await import("health/careFindings");
    const calls = [];
    const status = await fetchCareStatus(async url => {
      calls.push(url);
      if (url === "/care-api/status") return { ok: false, status: 502, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ findings: [] }) };
    });
    expect(status).toEqual({ findings: [] });
    expect(calls).toEqual(["/care-api/status", "http://care.my.ava.do/api/status"]);
  });
  it("throws when neither answers with JSON", async () => {
    const { fetchCareStatus } = await import("health/careFindings");
    await expect(fetchCareStatus(async () => ({ ok: true, status: 200, json: async () => { throw SyntaxError("html"); } }))).rejects.toThrow();
  });
});
