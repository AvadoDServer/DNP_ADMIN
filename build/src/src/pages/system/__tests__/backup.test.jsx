import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { passphraseProblem, errorText, jobText, humanSize, OLD_CORE_TEXT, LOST_TEXT, FAILED_TEXT } from "pages/system/backupApi";
import { BackupPanel, BackupPage, RestoreCard } from "pages/system/components/Backup";
import { canBackup, backupNeedsUpdate } from "health/clients";

const { state, api } = vi.hoisted(() => ({
  state: { packages: [], versionData: null },
  api: {
    backupStatus: vi.fn(),
    backupTargets: vi.fn(),
    backupSetup: vi.fn(),
    backupOptions: vi.fn(),
    backupNow: vi.fn(),
    backupFind: vi.fn(),
    backupRestore: vi.fn()
  }
}));
vi.mock("react-redux", () => ({ useSelector: selector => selector() }));
vi.mock("services/dnpInstalled/selectors", () => ({ getDnpInstalled: () => state.packages }));
vi.mock("services/dappnodeStatus/selectors", () => ({ getDappmanagerVersionData: () => state.versionData }));
vi.mock("API/rpcMethods", () => ({ default: api }));

const core = version => [{ name: "dappmanager.dnp.dappnode.eth", version, isCore: true }];
const disk = { id: "64B2-1A2F", name: "SanDisk Ultra Fit", size: 64e9, fsName: "exFAT", usable: true };
const vw = {
  name: "vaultwarden.avado.dnp.dappnode.eth",
  title: "Vaultwarden",
  included: true,
  includeLarge: false,
  validator: false,
  hasLarge: false,
  items: [{ name: "data", label: "Passwords, accounts and settings", included: true, found: true }]
};
const teku = { ...vw, name: "teku.avado.dnp.dappnode.eth", title: "Teku", validator: true, items: [{ name: "validator", validator: true, included: true }] };
const notSetUp = { setUp: false, target: null, weekly: false, apps: [vw], last: null, job: null };
const setUp = {
  ...notSetUp,
  setUp: true,
  weekly: true,
  target: { type: "usb", ...disk },
  last: { ok: true, at: "2026-11-05T09:00:00Z", endedAt: "2026-11-05T09:01:00Z", apps: [{ name: vw.name, title: "Vaultwarden", ok: true, bytes: 3e6 }] }
};

beforeEach(() => {
  state.packages = [...core("10.0.58"), { name: vw.name }, { name: teku.name }];
  Object.values(api).forEach(f => f.mockReset());
  api.backupTargets.mockResolvedValue({ disks: [disk] });
});

const wrap = ui => render(<MemoryRouter>{ui}</MemoryRouter>);
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("backup rules", () => {
  it("matches the DAPPMANAGER's passphrase rules", () => {
    expect(passphraseProblem("")).toBe("Type a passphrase.");
    expect(passphraseProblem("short")).toMatch(/at least 10/);
    expect(passphraseProblem("two\nlines here")).toMatch(/line breaks/);
    expect(passphraseProblem("correct horse battery")).toBe(null);
  });
  it("plain errors", () => {
    expect(errorText(Error("The passphrase is wrong."))).toBe("The passphrase is wrong.");
    expect(errorText(Error("wamp.error.no_such_procedure"))).toBe(OLD_CORE_TEXT);
    expect(errorText(Error("Connection is not open"))).toBe(LOST_TEXT);
    expect(errorText(Error("TypeError: x"))).toBe(FAILED_TEXT);
  });
  it("needs DAPPMANAGER 10.0.58", () => {
    expect(canBackup(core("10.0.57"))).toBe(false);
    expect(canBackup(core("10.0.58"))).toBe(true);
    expect(backupNeedsUpdate(core("10.0.54"))).toBe(true);
    expect(backupNeedsUpdate([])).toBe(false);
  });
  it("job and size texts", () => {
    expect(jobText({ kind: "backup", step: "app", current: vw.name, n: 1, total: 2 }, [vw])).toBe("Backing up Vaultwarden (1 of 2)…");
    expect(jobText({ kind: "restore", step: "stopping" })).toBe("Stopping the apps…");
    expect(humanSize(3e9)).toBe("3.0 GB");
  });
});

describe("Backup page", () => {
  it("an old core says to update first and makes no call", () => {
    state.packages = core("10.0.57");
    wrap(<BackupPage />);
    expect(screen.getByText(/needs an update before it can make backups/)).toBeInTheDocument();
    expect(api.backupStatus).not.toHaveBeenCalled();
  });

  it("first time: disk, passphrase twice, written down, Back up now", async () => {
    api.backupStatus.mockResolvedValue(notSetUp);
    api.backupSetup.mockResolvedValue(setUp);
    api.backupNow.mockResolvedValue({ started: true });
    wrap(<BackupPanel pollMs={50} />);
    expect(await screen.findByText("SanDisk Ultra Fit")).toBeInTheDocument();
    expect(screen.getByText(/only key to your backups/)).toBeInTheDocument();
    fill("Passphrase", "correct horse battery");
    fill("Passphrase again", "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Back up now" }));
    expect(await screen.findByText("Write the passphrase down first.")).toBeInTheDocument();
    expect(api.backupSetup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("I wrote the passphrase down and keep it safe."));
    fireEvent.click(screen.getByRole("button", { name: "Back up now" }));
    await waitFor(() => expect(api.backupNow).toHaveBeenCalled());
    expect(api.backupSetup).toHaveBeenCalledWith({ target: { type: "usb", id: disk.id }, passphrase: "correct horse battery", weekly: true });
  });

  it("no disk: says to plug one in", async () => {
    api.backupStatus.mockResolvedValue(notSetUp);
    api.backupTargets.mockResolvedValue({ disks: [] });
    wrap(<BackupPanel pollMs={50} />);
    expect(await screen.findByText(/No USB disk found/)).toBeInTheDocument();
  });

  it("set up: last backup, Back up now, Every week, Restore; main view stays short", async () => {
    api.backupStatus.mockResolvedValue(setUp);
    const { container } = wrap(<BackupPanel pollMs={50} />);
    expect(await screen.findByText(/Last backup/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    const words = container.textContent.split(/\s+/).filter(Boolean).length;
    expect(words).toBeLessThan(120);
  });

  it("shows the progress while a job runs", async () => {
    api.backupStatus.mockResolvedValue({ ...setUp, job: { kind: "backup", step: "app", current: vw.name, n: 1, total: 1, percent: 0.4, done: false } });
    wrap(<BackupPanel pollMs={50} />);
    expect(await screen.findByText("Backing up Vaultwarden…")).toBeInTheDocument();
  });
});

describe("Restore", () => {
  const found = {
    backups: [
      {
        repo: "avado-1234abcd",
        boxName: "AVADO",
        thisBox: false,
        runs: [
          {
            id: "20261105t090000",
            at: "2026-11-05T09:00:00Z",
            apps: [
              { name: vw.name, title: "Vaultwarden", items: ["settings", "data"], bytes: 3e6 },
              { name: teku.name, title: "Teku", items: ["settings", "validator"], bytes: 1e5 },
              { name: "immich.avado.dnp.dappnode.eth", title: "Immich", items: ["settings", "database"] }
            ]
          }
        ]
      }
    ]
  };

  it("pick, passphrase, choose; validator keys need the confirmation; missing apps link to the store", async () => {
    api.backupFind.mockResolvedValue(found);
    api.backupRestore.mockResolvedValue({ started: true });
    const onStarted = vi.fn();
    wrap(<RestoreCard status={{ ...setUp, apps: [vw, teku] }} installedNames={new Set([vw.name, teku.name])} onClose={() => {}} onStarted={onStarted} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show backups" }));
    fireEvent.click(await screen.findByText(/Another AVADO|AVADO ·/));
    expect(screen.getByText("install it first")).toBeInTheDocument();
    fill("Passphrase", "correct horse battery");
    // Teku is not ticked by default; tick it
    fireEvent.click(screen.getByLabelText(/^Teku/));
    expect(screen.getByText(/never run them in two places/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText(/Confirm the sentence about validator keys/)).toBeInTheDocument();
    expect(api.backupRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/The old AVADO is switched off/));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(api.backupRestore).toHaveBeenCalledWith({
      target: { type: "usb", id: disk.id },
      repo: "avado-1234abcd",
      run: "20261105t090000",
      passphrase: "correct horse battery",
      apps: [
        { name: vw.name, items: ["settings", "data"] },
        { name: teku.name, items: ["settings", "validator"] }
      ],
      confirmValidators: true
    });
  });

  it("a wrong passphrase is shown as the DAPPMANAGER says it", async () => {
    api.backupFind.mockResolvedValue(found);
    api.backupRestore.mockRejectedValue(Error("The passphrase is wrong."));
    wrap(<RestoreCard status={setUp} installedNames={new Set([vw.name])} onClose={() => {}} onStarted={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show backups" }));
    fireEvent.click(await screen.findByText(/AVADO ·/));
    fill("Passphrase", "not it at all");
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("The passphrase is wrong.")).toBeInTheDocument();
  });
});
