import { ipfsRestarting, IPFS_RESTARTING_WHY } from "health/rules/ipfs";
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

  it("finds nothing without an IPFS container, or with an unreadable answer", () => {
    expect(ipfsRestarting({ ipfsHealth: { ...restarting, exists: false } })).toEqual([]);
    expect(ipfsRestarting({ ipfsHealth: "nonsense" })).toEqual([]);
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
    expect(ipfsRestarting({ ipfsHealth: healthy, ipfsReset: { status: "done", origin: "finding" } })).toEqual([]);
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
