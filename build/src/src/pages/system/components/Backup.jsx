import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappmanagerVersionData } from "services/dappnodeStatus/selectors";
import { canBackup, backupNeedsUpdate } from "health/clients";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import ProgressBar from "components/ui/ProgressBar";
import { Input } from "components/ui/Input";
import { PageHeader } from "components/ui/PageHeader";
import { cn } from "components/ui/cn";
import {
  getStatus,
  getTargets,
  setupBackup,
  setOptions,
  backupNow,
  findBackups,
  restoreBackup,
  passphraseProblem,
  humanSize,
  humanDate,
  targetName,
  jobText,
  MIN_PASSPHRASE,
  OLD_CORE_TEXT,
} from "../backupApi";

/**
 * Settings > Backup (/system/backup, for Simple mode too).
 *
 * One path: plug in a USB disk, choose a passphrase, "Back up now".
 * Afterwards: the last backup, "Back up now", "Every week", "Restore".
 * Everything else (what each app includes, a NAS instead of a disk, another
 * disk or passphrase) is behind "More options".
 */

export function useBackupGate() {
  const packages = useSelector(getDnpInstalled) || [];
  const versionData = useSelector(getDappmanagerVersionData);
  const own = versionData && versionData.version;
  return { allowed: canBackup(packages, own), needsUpdate: backupNeedsUpdate(packages, own) };
}

const Note = ({ tone = "info", children, role }) => (
  <p
    role={role}
    className={cn(
      "mb-0 rounded-md px-3 py-2 text-sm",
      tone === "danger" && "bg-danger-subtle text-danger-text",
      tone === "warning" && "bg-warning-subtle text-warning-text",
      tone === "success" && "bg-success-subtle font-medium text-success-text",
      tone === "info" && "bg-surface-muted text-fg-muted"
    )}
  >
    {children}
  </p>
);

function Check({ checked, onChange, children, disabled, hint }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
      />
      <label htmlFor={id} className="mb-0 text-sm text-fg">
        {children}
        {hint && <span className="block text-xs text-fg-subtle">{hint}</span>}
      </label>
    </div>
  );
}

function SecretInput({ label, value, onChange, error, hint, autoComplete = "new-password" }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="mb-0 text-sm font-medium text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-control border bg-surface pl-3.5 pr-20 text-base text-fg transition-colors duration-150 focus:outline-none focus-visible:border-accent focus-visible:shadow-focus sm:text-sm",
            error ? "border-danger" : "border-border"
          )}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-pressed={shown}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-1 right-1 rounded-control px-3 text-sm font-semibold text-accent hover:bg-accent/10 focus:outline-none focus-visible:shadow-focus"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs text-danger-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------ where to ------------------------------ */

function DiskPicker({ value, onChange, disks, loading, onLookAgain }) {
  const usable = (disks || []).filter(d => d.usable);
  const unusable = (disks || []).filter(d => !d.usable);
  return (
    <div className="flex flex-col gap-2">
      {loading && !disks && <p className="mb-0 text-sm text-fg-muted">Looking for disks…</p>}
      {disks && !disks.length && <Note>No USB disk found. Plug one into your AVADO, then press Look again.</Note>}
      {usable.map(d => (
        <label
          key={d.id}
          className={cn(
            "mb-0 flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2.5",
            value === d.id ? "border-accent bg-accent/5" : "border-border"
          )}
        >
          <input type="radio" name="backup-disk" checked={value === d.id} onChange={() => onChange(d.id)} className="h-4 w-4" />
          <span className="min-w-0 text-sm text-fg">
            <span className="font-medium">{d.name}</span>
            <span className="block text-xs text-fg-subtle">
              {humanSize(d.size)} · {d.fsName}
            </span>
          </span>
        </label>
      ))}
      {unusable.map(d => (
        <Note key={d.id || d.name} tone="warning">
          {d.name}: {d.reason}
        </Note>
      ))}
      <Button variant="ghost" size="sm" className="self-start" loading={loading} onClick={onLookAgain}>
        Look again
      </Button>
    </div>
  );
}

function NasFields({ nas, setNas }) {
  const set = k => e => setNas({ ...nas, [k]: e.target.value });
  return (
    <div className="flex flex-col gap-3">
      <Input label="NAS address" placeholder="192.168.1.20" value={nas.host} onChange={set("host")} autoCapitalize="off" />
      <Input label="Shared folder" placeholder="backups" value={nas.share} onChange={set("share")} autoCapitalize="off" />
      <Input label="User name" value={nas.username} onChange={set("username")} autoComplete="off" autoCapitalize="off" />
      <SecretInput label="NAS password" value={nas.password} onChange={v => setNas({ ...nas, password: v })} autoComplete="off" />
    </div>
  );
}

/* ------------------------------ set up ------------------------------ */

export function SetupCard({ onDone, current }) {
  const [disks, setDisks] = useState(null);
  const [looking, setLooking] = useState(false);
  const [diskId, setDiskId] = useState(current && current.type === "usb" ? current.id : null);
  const [useNas, setUseNas] = useState(Boolean(current && current.type === "smb"));
  const [nas, setNas] = useState({ host: "", share: "", username: "", password: "", ...(current && current.type === "smb" ? current : {}) });
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [wrote, setWrote] = useState(false);
  const [weekly, setWeekly] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);

  const look = useCallback(async () => {
    setLooking(true);
    try {
      const r = await getTargets();
      setDisks(r.disks || []);
      const usable = (r.disks || []).filter(d => d.usable);
      if (usable.length === 1) setDiskId(id => id || usable[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLooking(false);
    }
  }, []);
  useEffect(() => {
    look();
  }, [look]);

  const passError = pass ? passphraseProblem(pass) : tried ? "Type a passphrase." : null;
  const againError = again && again !== pass ? "The two passphrases are not the same." : tried && !again ? "Type the passphrase again." : null;
  const placeMissing = useNas ? !nas.host || !nas.share : !diskId;

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    setError(null);
    if (placeMissing || passphraseProblem(pass) || again !== pass || !wrote) return;
    setBusy(true);
    try {
      const target = useNas ? { type: "smb", ...nas } : { type: "usb", id: diskId };
      await setupBackup({ target, passphrase: pass, weekly });
      setPass("");
      setAgain("");
      await backupNow();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" aria-labelledby="backup-setup-title" padding="lg">
      <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-5">
        <h2 id="backup-setup-title" className="mb-0 font-display text-lg font-semibold text-fg">
          {current ? "Change where backups go" : "Back up your AVADO"}
        </h2>
        <div className="flex flex-col gap-2">
          <h3 className="mb-0 text-sm font-semibold text-fg">1. {useNas ? "Your NAS" : "Plug a USB disk into your AVADO"}</h3>
          {useNas ? (
            <NasFields nas={nas} setNas={setNas} />
          ) : (
            <DiskPicker value={diskId} onChange={setDiskId} disks={disks} loading={looking} onLookAgain={look} />
          )}
          {tried && placeMissing && <Note tone="danger">{useNas ? "Type the NAS address and shared folder." : "Choose a disk."}</Note>}
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="mb-0 text-sm font-semibold text-fg">2. Choose a passphrase</h3>
          <SecretInput label="Passphrase" value={pass} onChange={setPass} error={passError} hint={`At least ${MIN_PASSPHRASE} characters. A short sentence works well.`} />
          <SecretInput label="Passphrase again" value={again} onChange={setAgain} error={againError} />
          <Note tone="warning">
            The passphrase is the only key to your backups. Without it nobody can open them, not even AVADO.
          </Note>
          <Check checked={wrote} onChange={setWrote}>
            I wrote the passphrase down and keep it safe.
          </Check>
          {tried && !wrote && <Note tone="danger">Write the passphrase down first.</Note>}
          <Check checked={weekly} onChange={setWeekly}>
            Back up every week while the disk is plugged in
          </Check>
        </div>
        {error && (
          <Note tone="danger" role="alert">
            {error}
          </Note>
        )}
        <Button type="submit" loading={busy} className="w-full sm:w-auto sm:self-start">
          {busy ? "Setting up…" : "Back up now"}
        </Button>
        <div>
          <button type="button" className="text-sm font-semibold text-accent hover:underline" aria-expanded={more} onClick={() => setMore(m => !m)}>
            More options
          </button>
          {more && (
            <div className="mt-3 flex flex-col gap-2 text-sm text-fg-muted">
              <Check checked={useNas} onChange={setUseNas}>
                Save to a NAS on your home network instead
              </Check>
              <p className="mb-0 text-xs text-fg-subtle">
                Backups are encrypted on the AVADO before they are saved. They never go to AVADO or the internet. Use a disk formatted as exFAT, NTFS or ext4.
              </p>
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------ job ------------------------------ */

function JobCard({ job, apps }) {
  const percent = typeof job.percent === "number" ? job.percent * 100 : 0;
  return (
    <Card as="section" padding="lg" className="flex flex-col gap-3" aria-live="polite">
      <h2 className="mb-0 font-display text-lg font-semibold text-fg">{job.kind === "restore" ? "Restoring" : "Backing up"}</h2>
      <p className="mb-0 text-sm text-fg">{jobText(job, apps)}</p>
      <ProgressBar value={percent} indeterminate={!job.percent} />
      <p className="mb-0 text-xs text-fg-subtle">You can close this page. {job.kind === "restore" ? "Do not unplug the disk." : "The apps keep running."}</p>
    </Card>
  );
}

/* ------------------------------ status ------------------------------ */

function LastBackup({ status }) {
  const last = status.last;
  if (!last) return <p className="mb-0 text-sm text-fg-muted">No backup yet.</p>;
  const failed = (last.apps || []).filter(a => !a.ok);
  if (!last.ok)
    return (
      <Note tone="danger">
        The last backup ({humanDate(last.at)}) did not work: {last.error || failed.map(a => `${a.title}: ${a.error}`).join("; ")}
      </Note>
    );
  const size = (last.apps || []).reduce((s, a) => s + (a.bytes || 0), 0);
  return (
    <Note tone="success">
      Last backup {humanDate(last.endedAt || last.at)}: {(last.apps || []).map(a => a.title).join(", ")} ({humanSize(size)}).
    </Note>
  );
}

function WhatIsIncluded({ status, onChange }) {
  const [saving, setSaving] = useState(false);
  const change = async (name, patch) => {
    setSaving(true);
    try {
      await onChange({ apps: { [name]: patch } });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <h3 className="mb-0 text-sm font-semibold text-fg">What is backed up</h3>
      {!status.apps.length && <p className="mb-0 text-sm text-fg-muted">No app with data to back up is installed.</p>}
      {status.apps.map(a => (
        <div key={a.name} className="flex flex-col gap-1.5">
          <Check
            checked={a.included}
            disabled={saving}
            onChange={v => change(a.name, { included: v })}
            hint={a.items
              .filter(i => !i.large)
              .map(i => i.label || i.name)
              .join(", ")}
          >
            {a.title}
          </Check>
          {a.hasLarge && a.included && (
            <div className="pl-8">
              <Check
                checked={a.includeLarge}
                disabled={saving}
                onChange={v => change(a.name, { includeLarge: v })}
                hint="Can be very large. Make sure the disk has room."
              >
                {a.items
                  .filter(i => i.large)
                  .map(i => i.label || i.name)
                  .join(", ")}
              </Check>
            </div>
          )}
        </div>
      ))}
      <p className="mb-0 text-xs text-fg-subtle">Each app's settings are always included. The last 4 backups and one per month are kept.</p>
    </div>
  );
}

function StatusCard({ status, onBackup, onRestore, onOptions, onChangePlace, busy, error }) {
  const [more, setMore] = useState(false);
  return (
    <Card as="section" aria-labelledby="backup-title" padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 id="backup-title" className="mb-1 font-display text-lg font-semibold text-fg">
          Backups
        </h2>
        <p className="mb-0 text-sm text-fg-muted">Saved encrypted to {targetName(status.target)}.</p>
      </div>
      <LastBackup status={status} />
      {status.weeklyNote && status.weekly && <Note tone="warning">Weekly backup: {status.weeklyNote.message}</Note>}
      {error && (
        <Note tone="danger" role="alert">
          {error}
        </Note>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onBackup} loading={busy}>
          Back up now
        </Button>
        <Button variant="secondary" onClick={onRestore}>
          Restore
        </Button>
      </div>
      <Check checked={status.weekly} onChange={v => onOptions({ weekly: v })}>
        Back up every week while the disk is plugged in
      </Check>
      <div>
        <button type="button" className="text-sm font-semibold text-accent hover:underline" aria-expanded={more} onClick={() => setMore(m => !m)}>
          More options
        </button>
        {more && (
          <div className="mt-3 flex flex-col gap-4">
            <WhatIsIncluded status={status} onChange={onOptions} />
            <Button variant="ghost" size="sm" className="self-start" onClick={onChangePlace}>
              Use another disk, a NAS or a new passphrase
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ restore ------------------------------ */

const INSTALLER = name => `/installer/${encodeURIComponent(name)}`;

export function RestoreCard({ status, onClose, onStarted, installedNames }) {
  const [disks, setDisks] = useState(null);
  const [diskId, setDiskId] = useState(status.target && status.target.type === "usb" ? status.target.id : null);
  const [found, setFound] = useState(null);
  const [looking, setLooking] = useState(false);
  const [pick, setPick] = useState(null); // { repo, run }
  const [pass, setPass] = useState("");
  const [chosen, setChosen] = useState({});
  const [confirmKeys, setConfirmKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nas = status.target && status.target.type === "smb" ? status.target : null;

  const targetOf = () => (nas ? { type: "smb", ...nas } : { type: "usb", id: diskId });

  const lookDisks = useCallback(async () => {
    setLooking(true);
    try {
      const r = await getTargets();
      setDisks(r.disks || []);
      const usable = (r.disks || []).filter(d => d.usable);
      if (usable.length === 1) setDiskId(id => id || usable[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLooking(false);
    }
  }, []);
  useEffect(() => {
    if (!nas) lookDisks();
  }, [lookDisks, nas]);

  const look = async () => {
    setError(null);
    setLooking(true);
    try {
      const r = await findBackups({ target: targetOf() });
      setFound(r.backups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLooking(false);
    }
  };

  const runs = (found || []).flatMap(b => (b.runs || []).map(r => ({ ...r, repo: b.repo, boxName: b.boxName, thisBox: b.thisBox })));
  const run = pick && runs.find(r => r.repo === pick.repo && r.id === pick.run);
  const validatorApp = name => {
    const a = (status.apps || []).find(x => x.name === name);
    return a ? a.validator : /^(teku|nimbus|lighthouse|eth2validator)[.-]/.test(name);
  };
  const selected = run ? run.apps.filter(a => chosen[a.name]) : [];
  const needsKeys = selected.some(a => validatorApp(a.name));

  const start = async e => {
    e.preventDefault();
    setError(null);
    if (!pass) return setError("Type the passphrase of this backup.");
    if (!selected.length) return setError("Choose what to restore.");
    if (needsKeys && !confirmKeys) return setError("Confirm the sentence about validator keys first.");
    setBusy(true);
    try {
      await restoreBackup({
        target: targetOf(),
        repo: run.repo,
        run: run.id,
        passphrase: pass,
        apps: selected.map(a => ({ name: a.name, items: a.items && a.items.length ? a.items : ["settings"] })),
        confirmValidators: needsKeys ? confirmKeys : undefined
      });
      setPass("");
      onStarted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" aria-labelledby="restore-title" padding="lg">
      <form onSubmit={start} noValidate className="flex max-w-md flex-col gap-5">
        <h2 id="restore-title" className="mb-0 font-display text-lg font-semibold text-fg">
          Restore from a backup
        </h2>
        {/* 1. Which backup */}
        <div className="flex flex-col gap-2">
          <h3 className="mb-0 text-sm font-semibold text-fg">1. Pick the backup</h3>
          {!nas && <DiskPicker value={diskId} onChange={setDiskId} disks={disks} loading={looking && !found} onLookAgain={lookDisks} />}
          <Button variant="secondary" size="sm" className="self-start" loading={looking && Boolean(disks || nas)} disabled={!nas && !diskId} onClick={look}>
            Show backups
          </Button>
          {found && !runs.length && <Note>There are no AVADO backups on this {nas ? "NAS folder" : "disk"}.</Note>}
          {runs.map(r => (
            <label
              key={`${r.repo}/${r.id}`}
              className={cn(
                "mb-0 flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5",
                pick && pick.repo === r.repo && pick.run === r.id ? "border-accent bg-accent/5" : "border-border"
              )}
            >
              <input
                type="radio"
                name="backup-run"
                className="mt-1 h-4 w-4"
                checked={Boolean(pick && pick.repo === r.repo && pick.run === r.id)}
                onChange={() => {
                  setPick({ repo: r.repo, run: r.id });
                  setChosen(Object.fromEntries(r.apps.map(a => [a.name, installedNames.has(a.name) && !validatorApp(a.name)])));
                  setConfirmKeys(false);
                }}
              />
              <span className="text-sm text-fg">
                <span className="font-medium">{humanDate(r.at)}</span>
                <span className="block text-xs text-fg-subtle">
                  {r.thisBox ? "This AVADO" : r.boxName || "Another AVADO"} · {r.apps.map(a => a.title).join(", ")}
                </span>
              </span>
            </label>
          ))}
        </div>
        {run && (
          <>
            <div className="flex flex-col gap-3">
              <h3 className="mb-0 text-sm font-semibold text-fg">2. Type its passphrase</h3>
              <SecretInput label="Passphrase" value={pass} onChange={setPass} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="mb-0 text-sm font-semibold text-fg">3. Choose what to restore</h3>
              {run.apps.map(a =>
                installedNames.has(a.name) ? (
                  <Check
                    key={a.name}
                    checked={Boolean(chosen[a.name])}
                    onChange={v => setChosen({ ...chosen, [a.name]: v })}
                    hint={validatorApp(a.name) ? "Validator keys and slashing protection" : humanSize(a.bytes)}
                  >
                    {a.title}
                  </Check>
                ) : (
                  <p key={a.name} className="mb-0 text-sm text-fg-muted">
                    {a.title}:{" "}
                    <Link to={INSTALLER(a.name)} className="font-semibold text-accent hover:underline">
                      install it first
                    </Link>
                    , then come back.
                  </p>
                )
              )}
              <p className="mb-0 text-xs text-fg-subtle">
                The apps stop while they are restored. What they hold now is kept aside on the AVADO, not deleted.
              </p>
            </div>
            {needsKeys && (
              <div className="flex flex-col gap-3 rounded-md border border-danger p-3">
                <p className="mb-0 text-sm font-semibold text-danger-text">Validator keys: never run them in two places</p>
                <p className="mb-0 text-sm text-fg">
                  If the same keys sign on two machines, part of your stake is taken away (slashed). Switch the old AVADO off for good, or remove
                  the keys from it, first. The validator stays stopped after the restore; start it yourself once you are sure.
                </p>
                <Check checked={confirmKeys} onChange={setConfirmKeys}>
                  The old AVADO is switched off, or these keys are removed from it.
                </Check>
              </div>
            )}
          </>
        )}
        {error && (
          <Note tone="danger" role="alert">
            {error}
          </Note>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {run && (
            <Button type="submit" loading={busy} variant={needsKeys ? "danger" : "primary"}>
              Restore
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function RestoreResult({ result, onClose }) {
  if (!result) return null;
  const ok = (result.apps || []).filter(a => a.ok);
  const bad = (result.apps || []).filter(a => !a.ok);
  return (
    <Card as="section" padding="lg" className="flex flex-col gap-3" aria-live="polite">
      <h2 className="mb-0 font-display text-lg font-semibold text-fg">{result.ok ? "Restored" : "Restore finished with problems"}</h2>
      {ok.length > 0 && <Note tone="success">Restored: {ok.map(a => a.title).join(", ")}.</Note>}
      {bad.map(a => (
        <Note key={a.name} tone="danger">
          {a.title}: {a.error}
        </Note>
      ))}
      {result.error && <Note tone="danger">{result.error}</Note>}
      {(result.keptStopped || []).map(a => (
        <p key={a.name} className="mb-0 text-sm text-fg">
          {a.title} is stopped. Start it only when the old AVADO is off for good:{" "}
          <Link to={`/packages/${a.name}`} className="font-semibold text-accent hover:underline">
            open {a.title}
          </Link>
          .
        </p>
      ))}
      <Button variant="secondary" size="sm" className="self-start" onClick={onClose}>
        Done
      </Button>
    </Card>
  );
}

/* ------------------------------ page ------------------------------ */

export function BackupPanel({ pollMs = 2000 }) {
  const packages = useSelector(getDnpInstalled) || [];
  const installedNames = new Set(packages.map(p => p && p.name).filter(Boolean));
  const [status, setStatus] = useState(null);
  const [view, setView] = useState("home"); // home | setup | restore
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showRestoreResult, setShowRestoreResult] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
      setError(null);
      return s;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  // Poll every few seconds while a job runs, else every half minute. kick()
  // asks at once and restarts the rhythm (after a backup or restore starts).
  const tickRef = useRef(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      clearTimeout(timer.current);
      const s = await load();
      if (!alive) return;
      const running = s && s.job && !s.job.done;
      timer.current = setTimeout(tick, running ? pollMs : pollMs * 15);
    };
    tickRef.current = tick;
    tick();
    return () => {
      alive = false;
      tickRef.current = null;
      clearTimeout(timer.current);
    };
  }, [load, pollMs]);
  const kick = () => tickRef.current && tickRef.current();

  if (!status) return error ? <Note tone="danger">{error}</Note> : <p className="text-sm text-fg-muted">Loading…</p>;
  const running = status.job && !status.job.done;
  if (running) return <JobCard job={status.job} apps={status.apps} />;

  if (showRestoreResult && status.lastRestore)
    return (
      <RestoreResult
        result={status.lastRestore}
        onClose={() => {
          setShowRestoreResult(false);
          setView("home");
        }}
      />
    );

  if (view === "restore")
    return (
      <RestoreCard
        status={status}
        installedNames={installedNames}
        onClose={() => setView("home")}
        onStarted={() => {
          setShowRestoreResult(true);
          kick();
        }}
      />
    );

  if (!status.setUp || view === "setup")
    return (
      <div className="flex flex-col gap-4">
        <SetupCard
          current={status.setUp ? status.target : null}
          onDone={() => {
            setView("home");
            kick();
          }}
        />
        {status.setUp && (
          <Button variant="ghost" className="self-start" onClick={() => setView("home")}>
            Cancel
          </Button>
        )}
        {!status.setUp && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setView("restore")}>
            Restore a backup from another AVADO
          </Button>
        )}
      </div>
    );

  return (
    <StatusCard
      status={status}
      busy={busy}
      error={error}
      onBackup={async () => {
        setBusy(true);
        setError(null);
        try {
          await backupNow();
          kick();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
      onRestore={() => setView("restore")}
      onChangePlace={() => setView("setup")}
      onOptions={async patch => {
        try {
          setStatus(await setOptions(patch));
        } catch (e) {
          setError(e.message);
        }
      }}
    />
  );
}

/** /system/backup */
export function BackupPage() {
  const { allowed, needsUpdate } = useBackupGate();
  return (
    <div className="animate-fade-in">
      <PageHeader title="Backup" subtitle="A locked copy of your apps' data, on your own disk." />
      {needsUpdate ? (
        <Card padding="lg">
          <p className="mb-0 text-sm text-fg">
            {OLD_CORE_TEXT}{" "}
            <Link to="/system/updates" className="font-semibold text-accent hover:underline">
              Open Updates
            </Link>
          </p>
        </Card>
      ) : allowed ? (
        <BackupPanel />
      ) : (
        <p className="text-sm text-fg-muted">Loading…</p>
      )}
    </div>
  );
}

/** System > Overview: a short card that leads to the page */
export function BackupCard() {
  return (
    <Card as="section" padding="lg" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="mb-1 font-display text-lg font-semibold text-fg">Backup</h2>
        <p className="mb-0 text-sm text-fg-muted">Encrypted backups of your apps and validator keys, on your own USB disk or NAS.</p>
      </div>
      <Link to="/system/backup" className="shrink-0 font-semibold text-accent hover:underline">
        Open Backup
      </Link>
    </Card>
  );
}

export default BackupPage;
