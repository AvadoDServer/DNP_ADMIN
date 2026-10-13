import { ipfsRestarting, IPFS_RESTARTING_WHY, IPFS_MISSING_WHY, IPFS_RESULT_NOTE_MS, IPFS_MISSING_AFTER_MS } from "health/rules/ipfs";
import { appRestarting } from "health/rules/apps";
import { canResetIpfsData, IPFS_RESET_SINCE } from "health/clients";
import { runChecksDetailed } from "health/engine";

const IPFS = "ipfs.dnp.dappnode.eth";
const healthy = {
  exists: true,
  running: true,
  restarting: false,
  restartCount: 0,
  restartsLastHour: 0,
  startedAt: "2026-10-13T08:00:00Z",
  lastLogLines: [],
  resetRunning: false,
};
const restarting = {
  ...healthy,
  running: false,
  restarting: true,
  restartCount: 41,
  restartsLastHour: 6,
  lastLogLines: ["Found IPFS fs-repo at /data/ipfs", "Error: failed to open datastore: leveldb: corrupted"],
};

describe("ipfsRestarting rule", () => {
  it("finds nothing while IPFS is healthy, or restarted twice in the last hour", () => {
    expect(ipfsRestarting({ ipfsHealth: healthy })).toEqual([]);
    expect(ipfsRestarting({ ipfsHealth: { ...healthy, restartsLastHour: 2, restartCount: 50 } })).toEqual([]);
  });

  it("finds nothing with an unreadable answer", () => {
    expect(ipfsRestarting({ ipfsHealth: "nonsense" })).toEqual([]);
  });

  it("no IPFS container (DAPPMANAGER 10.0.52 says exists: false): 'IPFS is missing', same button, not hideable", () => {
    const now = Date.parse("2026-10-13T08:05:00Z");
    const missing = { ...healthy, exists: false, running: false, missingSince: "2026-10-13T08:00:00Z" };
    const [f, ...rest] = ipfsRestarting({ ipfsHealth: missing, now });
    expect(rest).toEqual([]);
    expect(f).toMatchObject({
      id: "ipfs-restarting",
      severity: "critical",
      title: "IPFS is missing",
      why: IPFS_MISSING_WHY,
      fix: { kind: "action", action: "resetIpfsData", label: "Reset IPFS storage" },
      dismissable: false,
    });
    expect(f.why).not.toMatch(/container|volume|docker/i);
    // but not while a reset runs (the DAPPMANAGER's or this page's)
    expect(ipfsRestarting({ ipfsHealth: { ...missing, resetRunning: true }, now })).toEqual([]);
    expect(ipfsRestarting({ ipfsHealth: missing, ipfsReset: { status: "running", origin: "storage" }, now })).toEqual([]);
  });

  it("missing for less than a minute (an update or restart of IPFS) or without missingSince: no finding yet", () => {
    const since = Date.parse("2026-10-13T08:00:00Z");
    const missing = { ...healthy, exists: false, running: false, missingSince: "2026-10-13T08:00:00Z" };
    expect(ipfsRestarting({ ipfsHealth: missing, now: since + 5000 })).toEqual([]);
    expect(ipfsRestarting({ ipfsHealth: missing, now: since + IPFS_MISSING_AFTER_MS - 1 })).toEqual([]);
    expect(ipfsRestarting({ ipfsHealth: missing, now: since + IPFS_MISSING_AFTER_MS })).toHaveLength(1);
    expect(ipfsRestarting({ ipfsHealth: { ...missing, missingSince: null }, now: since + 600000 })).toEqual([]);
  });

  it("a restarting IPFS: one critical finding with the reset button, not hideable", () => {
    const [f, ...rest] = ipfsRestarting({ ipfsHealth: restarting });
    expect(rest).toEqual([]);
    expect(f).toMatchObject({
      id: "ipfs-restarting",
      severity: "critical",
      topic: "core",
      appId: IPFS,
      title: "IPFS keeps restarting",
      why: IPFS_RESTARTING_WHY,
      fix: { kind: "action", action: "resetIpfsData", label: "Reset IPFS storage" },
      dismissable: false,
    });
    expect(f.detail).toBe("Last log line: Error: failed to open datastore: leveldb: corrupted");
  });

  it("3 restarts in the last hour while up at the moment: the finding, hideable", () => {
    const [f] = ipfsRestarting({ ipfsHealth: { ...healthy, restartsLastHour: 3, restartCount: 3 } });
    expect(f.id).toBe("ipfs-restarting");
    expect(f.dismissable).toBe(true);
    expect(f.detail).toBeUndefined();
  });

  it("the copy is plain: no container, volume or command names", () => {
    const [f] = ipfsRestarting({ ipfsHealth: restarting });
    for (const text of [f.title, f.why, f.fix.label]) {
      expect(text).not.toMatch(/DAppNodeCore|dncore|volume|docker|ipfsdnpdappnodeeth|\/data/i);
    }
  });

  it("stays while a reset started from it runs, so its progress stays in view", () => {
    // During the reset the container is removed: exists false
    const during = { ...healthy, exists: false, running: false, resetRunning: true };
    expect(ipfsRestarting({ ipfsHealth: during, ipfsReset: { status: "running", origin: "finding" } })).toHaveLength(1);
    expect(ipfsRestarting({ ipfsHealth: during, ipfsReset: { status: "running", origin: "storage" } })).toEqual([]);
    // done, but without an end time: no note
    expect(ipfsRestarting({ ipfsHealth: healthy, ipfsReset: { status: "done", origin: "finding" } })).toEqual([]);
  });

  it("for a minute after a reset from the finding ended: 'Done: …' as a note, or the error on the finding", () => {
    const now = 1_000_000;
    const done = { status: "done", origin: "finding", text: "Done: 1.3 GB removed, IPFS is running again", endedAt: now - 5000 };
    const [note, ...rest] = ipfsRestarting({ ipfsHealth: healthy, ipfsReset: done, now });
    expect(rest).toEqual([]);
    expect(note).toMatchObject({ id: "ipfs-reset-done", severity: "info", title: done.text, dismissable: false });
    expect(note.fix).toBeUndefined();
    // gone after a minute, and never for a reset started on System > Storage
    expect(ipfsRestarting({ ipfsHealth: healthy, ipfsReset: done, now: done.endedAt + IPFS_RESULT_NOTE_MS + 1 })).toEqual([]);
    expect(ipfsRestarting({ ipfsHealth: healthy, ipfsReset: { ...done, origin: "storage" }, now })).toEqual([]);

    const failed = { status: "error", origin: "finding", text: "IPFS did not start again.", endedAt: now - 5000 };
    const [f] = ipfsRestarting({ ipfsHealth: healthy, ipfsReset: failed, now });
    expect(f).toMatchObject({ id: "ipfs-restarting", severity: "critical", dismissable: false });
  });

  it("is skipped (not counted) without ipfsHealth, i.e. with a DAPPMANAGER before 10.0.52", () => {
    expect(runChecksDetailed({ ipfsHealth: null }, [ipfsRestarting])).toEqual({ findings: [], passed: 0, total: 0 });
    expect(runChecksDetailed({ ipfsHealth: healthy }, [ipfsRestarting])).toEqual({ findings: [], passed: 1, total: 1 });
  });
});

describe("appRestarting leaves IPFS to ipfsRestarting", () => {
  const packages = [
    { name: IPFS, isCore: true, state: "restarting", manifest: { title: "AVADO IPFS node" } },
    { name: "teku.avado.dnp.dappnode.eth", state: "restarting", manifest: { title: "Teku" } },
  ];
  it("once the DAPPMANAGER reports on IPFS", () => {
    expect(appRestarting({ packages, ipfsHealth: restarting }).map(f => f.appId)).toEqual(["teku.avado.dnp.dappnode.eth"]);
  });
  it("but still covers IPFS with an older DAPPMANAGER", () => {
    expect(appRestarting({ packages, ipfsHealth: null }).map(f => f.appId)).toEqual([IPFS, "teku.avado.dnp.dappnode.eth"]);
  });
});

describe("canResetIpfsData", () => {
  const dm = version => [{ name: "dappmanager.dnp.dappnode.eth", isCore: true, version }];
  it("is true from DAPPMANAGER 10.0.52 on", () => {
    expect(IPFS_RESET_SINCE).toBe("10.0.52");
    expect(canResetIpfsData(dm("10.0.52"))).toBe(true);
    expect(canResetIpfsData(dm("10.0.60"))).toBe(true);
    expect(canResetIpfsData(dm("10.1.0"))).toBe(true);
  });
  it("is false before, or when the version cannot be read", () => {
    expect(canResetIpfsData(dm("10.0.51"))).toBe(false);
    expect(canResetIpfsData(dm("/ipfs/QmHash"))).toBe(false);
    expect(canResetIpfsData([])).toBe(false);
  });
});
