import {
  feeRecipientMissing,
  FEE_RECIPIENT_STEPS,
  twoValidatorClients,
  TWO_VALIDATOR_APPS_STEPS,
  KEY_MOVE_WAIT_MINUTES,
  joinNames,
} from "health/rules/validators";
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

describe("twoValidatorClients", () => {
  const TEKU = "teku.avado.dnp.dappnode.eth";
  const LIGHTHOUSE = "lighthouse.avado.dnp.dappnode.eth";
  const PRYSM_BEACON = "prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth";
  const PRYSM_VALIDATOR = "eth2validator.avado.dnp.dappnode.eth";
  const titled = (name, title, overrides) => pkg(name, { manifest: { name, title }, ...overrides });
  const run = packages => twoValidatorClients(snapshot({ packages }));

  it("warns (never critical) when two validator apps are installed for the same network", () => {
    const [f, ...rest] = run([titled(NIMBUS, "Nimbus"), titled(TEKU, "Teku")]);
    expect(rest).toEqual([]);
    expect(f).toMatchObject({
      id: "two-validator-clients:mainnet",
      severity: "warning",
      topic: "setup",
      dismissable: true,
      title: "Nimbus and Teku are both installed for Ethereum mainnet",
      fix: { kind: "steps" },
    });
    expect(f.why).toMatch(/one app only/);
    // Hide is offered on Home only (FindingRow canHide).
    expect(f.why).toMatch(/hide this on Home/);
    expect(f.steps).toEqual(TWO_VALIDATOR_APPS_STEPS);
    // No "Read more": that docs page opens with "Stop the validators".
    expect(f.learnMore).toBeUndefined();
  });

  it("walks through the safe order: remove the validators, wait, import, remove the old app, never just stop it", () => {
    // docs.ava.do asks for at least 5 finalized epochs (about 32 minutes) and
    // recommends 10 (64 minutes): never less than that.
    expect(KEY_MOVE_WAIT_MINUTES).toBeGreaterThanOrEqual(64);
    expect(TWO_VALIDATOR_APPS_STEPS).toHaveLength(5);
    // Rocket Pool picks its app in a package setting, not in Rocket Pool: support first.
    expect(TWO_VALIDATOR_APPS_STEPS[0]).toMatch(/Rocket Pool validators, contact AVADO support before you start/);
    expect(TWO_VALIDATOR_APPS_STEPS[1]).toMatch(/remove your validators/);
    expect(TWO_VALIDATOR_APPS_STEPS[1]).toMatch(/Stopping the app is not enough/);
    // One slashing-protection file per validator, imported with its own key.
    expect(TWO_VALIDATOR_APPS_STEPS[1]).toMatch(/slashing-protection files .*\(one per validator\)/);
    expect(TWO_VALIDATOR_APPS_STEPS[2]).toBe(`Wait at least ${KEY_MOVE_WAIT_MINUTES} minutes.`);
    expect(TWO_VALIDATOR_APPS_STEPS[3]).toMatch(/^Import your validators/);
    expect(TWO_VALIDATOR_APPS_STEPS[3]).toMatch(/each with its own slashing-protection file/);
    expect(TWO_VALIDATOR_APPS_STEPS[4]).toMatch(/remove the old app/);
    for (const step of TWO_VALIDATOR_APPS_STEPS) {
      expect(step).not.toMatch(/^Stop/);
      expect(step).not.toMatch(/Rocket Pool's settings|follow its prompts|that file/);
    }
  });

  it("counts a stopped app: it starts again by itself after a reboot or an update", () => {
    const stopped = titled(TEKU, "Teku", { state: "exited", running: false });
    expect(run([titled(NIMBUS, "Nimbus"), stopped])).toHaveLength(1);
  });

  it("Prysm's beacon chain and validator are one validator app, and the beacon chain alone holds no keys", () => {
    expect(run([pkg(PRYSM_BEACON), pkg(PRYSM_VALIDATOR)])).toEqual([]);
    expect(run([pkg(PRYSM_BEACON), titled(TEKU, "Teku")])).toEqual([]);
    const [f] = run([pkg(PRYSM_BEACON), titled(PRYSM_VALIDATOR, "Prysm"), titled(TEKU, "Teku")]);
    expect(f.title).toBe("Prysm and Teku are both installed for Ethereum mainnet");
  });

  it("keeps networks apart and skips the retired Goerli/Prater testnet", () => {
    expect(run([titled(NIMBUS, "Nimbus"), pkg("teku-holesky.avado.dnp.dappnode.eth")])).toEqual([]);
    expect(run([pkg("teku-gnosis.avado.dnp.dappnode.eth"), pkg("nethermind-gnosis.avado.dnp.dappnode.eth")])).toEqual([]);
    const [f, ...rest] = run([
      titled(NIMBUS, "Nimbus"),
      titled("teku-holesky.avado.dnp.dappnode.eth", "Teku Holesky Testnet"),
      titled("lighthouse-holesky.avado.dnp.dappnode.eth", "Lighthouse Holesky Testnet"),
    ]);
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ id: "two-validator-clients:holesky", title: "Teku Holesky Testnet and Lighthouse Holesky Testnet are both installed for Holesky testnet" });
    expect(run([pkg("nimbus-prater.avado.dnp.dappnode.eth"), pkg("teku-prater.avado.dnp.dappnode.eth")])).toEqual([]);
  });

  it("one finding per network, naming every app", () => {
    const findings = run([
      titled(NIMBUS, "Nimbus"),
      titled(TEKU, "Teku"),
      titled(LIGHTHOUSE, "Lighthouse"),
      pkg("teku-gnosis.avado.dnp.dappnode.eth"),
      pkg("lighthouse-gnosis.avado.dnp.dappnode.eth"),
    ]);
    expect(findings.map(f => f.id)).toEqual(["two-validator-clients:mainnet", "two-validator-clients:gnosis"]);
    expect(findings[0].title).toBe("Nimbus, Teku and Lighthouse are all installed for Ethereum mainnet");
    expect(findings[1].title).toBe("teku-gnosis and lighthouse-gnosis are both installed for Gnosis chain");
  });

  it("no finding with one validator app or none", () => {
    expect(run([titled(NIMBUS, "Nimbus"), pkg("ethchain-geth.public.dappnode.eth")])).toEqual([]);
    expect(run([])).toEqual([]);
    expect(twoValidatorClients(snapshot({ packages: undefined }))).toEqual([]);
  });

  it("runs as part of ALL_RULES and stays a warning", () => {
    const s = snapshot({ packages: [pkg("ethchain-geth.public.dappnode.eth"), titled(NIMBUS, "Nimbus"), titled(TEKU, "Teku")] });
    const f = runChecksDetailed(s, ALL_RULES).findings.find(x => x.id === "two-validator-clients:mainnet");
    expect(f).toMatchObject({ severity: "warning" });
  });

  it("joinNames reads like a sentence", () => {
    expect(joinNames(["Nimbus"])).toBe("Nimbus");
    expect(joinNames(["Nimbus", "Teku"])).toBe("Nimbus and Teku");
    expect(joinNames(["Nimbus", "Teku", "Lighthouse"])).toBe("Nimbus, Teku and Lighthouse");
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
