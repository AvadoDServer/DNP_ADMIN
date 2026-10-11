import { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getConnectionStatus } from "services/connectionStatus/selectors";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import { SectionHeader } from "./PackagePresentation";
import { confirm } from "components/ConfirmDialog";
// Logic
import { canFindLostData } from "health/clients";
import { appTitle } from "health/rules/apps";
import { formatDockerSize } from "health/rules/storage";
import { findLostData, recoverLostData, recoveryInFlight, forgetRecovery, STILL_COPYING_AFTER_MS } from "../lostDataApi";

const CONFIRM_TEXT =
  "This copies the files from the old storage into the app's storage. Files that are already there are kept. The app restarts; this can take a few minutes. Nothing is deleted.";
const STILL_COPYING =
  "Still copying. This can take a while for a lot of data. You can leave this page and come back later.";
const WARNING_TAIL = "If the app does not work as before, contact AVADO support.";
// After a dropped connection the recovery's answer is lost (autobahn never
// settles the call): the card asks findLostData every 30 s instead, for up
// to 30 minutes.
export const POLL_MS = 30 * 1000;
export const POLL_LIMIT_MS = 30 * 60 * 1000;
const DONE_WHILE_AWAY =
  "The copy finished while this page was not connected. If the app does not work as before, contact AVADO support.";
const NOT_SURE =
  "Could not tell whether the copy finished. Reload the page; if the data is not back, contact AVADO support.";
// A "low" confidence candidate is an anonymous volume that only looks like
// this app's data (a "high" one is named after the app; missing = high).
const LOW_CONFIDENCE =
  "This storage may belong to another app. Only recover it if this app lost its data after an update, and contact AVADO support if you are not sure.";

const NOTICE = {
  success: "border-success/40 bg-success-subtle text-success-text",
  warning: "border-warning/40 bg-warning-subtle text-warning-text",
  danger: "border-danger/40 bg-danger-subtle text-danger-text",
  neutral: "border-border bg-bg-subtle text-fg-muted",
};

// "March 1, 2025" (read as UTC, like the relay list date), or null.
function onDate(value) {
  const date = new Date(value);
  if (typeof value !== "string" || !value || isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// "2.1 MB (.rocketpool, data)": du -sk counts KiB.
function contents(candidate) {
  const size = formatDockerSize((Number(candidate.sizeKb) || 0) * 1024);
  const entries = Array.isArray(candidate.entries) ? candidate.entries.join(", ") : "";
  return entries ? `${size} (${entries})` : size;
}

// The notices for a finished recovery: { files, sizeKb, skipped, warning? }.
function successNotices(result) {
  const files = Number(result && result.files) || 0;
  const skipped = Number(result && result.skipped) || 0;
  const notices = [
    {
      variant: "success",
      text:
        skipped > 0
          ? `Done: ${Math.max(files - skipped, 0)} files recovered. ${skipped} files were already in the app's storage and were kept. The app is starting again.`
          : `Done: ${files} files recovered. The app is starting again.`,
    },
  ];
  if (result && typeof result.warning === "string" && result.warning)
    notices.push({ variant: "warning", text: `${result.warning} ${WARNING_TAIL}` });
  return notices;
}

/**
 * "Data found in an unused storage volume", on every app's overview: the
 * app's data in a storage volume no container uses (left behind by an
 * update, say), and a one-click "Recover data" that copies it back.
 * DAPPMANAGER 10.0.51 and newer only; with an older one, or on a core
 * package, the card renders nothing and makes no call. Shown while there is
 * something to recover, a recovery runs, or one finished on this page;
 * volumes already recovered are listed only inside a card that shows.
 *
 * A recovery runs until the DAPPMANAGER answers, however long that takes
 * (after 10 minutes the card says it is still copying). It lives in
 * lostDataApi, not here: leaving the page and coming back shows it running.
 * One sent on an earlier WAMP session (the connection dropped) is polled
 * with findLostData instead, as its answer can no longer arrive.
 */
export function LostDataCardView({
  dnp,
  packages,
  session = null,
  onFinished,
  findLostDataImpl = findLostData,
  recoverLostDataImpl = recoverLostData,
  recoveryInFlightImpl = recoveryInFlight,
  forgetRecoveryImpl = forgetRecovery,
}) {
  // Core packages are left out: listLostData skips them and recoverLostData refuses them.
  const allowed = canFindLostData(packages) && !(dnp && dnp.isCore);
  const id = dnp && dnp.name;
  // The last findLostData answer: { candidates, recovered }
  const [entry, setEntry] = useState(null);
  // volume -> when it was recovered here, until findLostData lists it as recovered
  const [doneHere, setDoneHere] = useState({});
  const [finishedHere, setFinishedHere] = useState(false);
  // { volume, startedAt } while a recovery of this package runs
  const [running, setRunning] = useState(null);
  const [slow, setSlow] = useState(false);
  const [notices, setNotices] = useState([]);
  const [scan, setScan] = useState(0);
  // Each volume's size and contents, kept for its row once it is recovered.
  const known = useRef({});
  const alive = useRef(false);
  // Which recovery the card is watching: starting another watch (or a
  // cleanup) bumps it, and older handlers then do nothing.
  const watch = useRef(0);
  const pollTimer = useRef(null);

  const stopPolling = () => {
    clearInterval(pollTimer.current);
    pollTimer.current = null;
  };
  const finish = () => {
    setRunning(null);
    setFinishedHere(true);
    // After a failure too: the DAPPMANAGER may have copied the data and
    // only failed to start the app again.
    setScan(s => s + 1);
  };

  // Show a recovery: the one just started, or one still running from an
  // earlier visit to this page. Only this card's own display depends on it.
  function follow(recovery) {
    const token = ++watch.current;
    const current = () => alive.current && watch.current === token;
    setRunning({ volume: recovery.volume, startedAt: recovery.startedAt });
    setNotices([]);
    recovery.promise
      .then(
        result => {
          if (!current()) return;
          setDoneHere(d => ({ ...d, [recovery.volume]: new Date().toISOString() }));
          setNotices(successNotices(result));
        },
        e => {
          if (!current()) return;
          setNotices([{ variant: "danger", text: (e && e.message) || "Recovering the data failed. Try again." }]);
        }
      )
      .then(() => current() && finish());
  }

  // A recovery sent before the connection dropped: its promise never
  // settles, so ask findLostData until the volume shows as recovered.
  function poll(recovery) {
    const token = ++watch.current;
    const current = () => alive.current && watch.current === token;
    const began = Date.now();
    stopPolling();
    setRunning({ volume: recovery.volume, startedAt: recovery.startedAt });
    setNotices([]);
    const done = notice => {
      stopPolling();
      forgetRecoveryImpl(id, recovery.volume);
      setNotices([notice]);
      finish();
    };
    pollTimer.current = setInterval(() => {
      if (!current()) return stopPolling();
      Promise.resolve()
        .then(() => findLostDataImpl(id))
        .then(
          found => {
            if (!current()) return;
            const recovered = found && Array.isArray(found.recovered) ? found.recovered : [];
            if (recovered.some(r => r && r.volume === recovery.volume)) {
              setDoneHere(d => ({ ...d, [recovery.volume]: new Date().toISOString() }));
              done({ variant: "success", text: DONE_WHILE_AWAY });
              if (onFinished) onFinished(recovery.volume);
            } else if (Date.now() - began >= POLL_LIMIT_MS) {
              done({ variant: "danger", text: NOT_SURE });
            }
          },
          () => {
            // Not answered this time: ask again on the next round, up to the limit.
            if (current() && Date.now() - began >= POLL_LIMIT_MS) done({ variant: "danger", text: NOT_SURE });
          }
        );
    }, POLL_MS);
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Pick up this package's running recovery, on mount and whenever the WAMP
  // session changes: follow it when it was sent on this session, else poll.
  useEffect(() => {
    if (!allowed || !id) return undefined;
    const pending = recoveryInFlightImpl(id);
    if (pending) {
      if ((pending.session || null) === (session || null)) follow(pending);
      else poll(pending);
    }
    return () => {
      watch.current++;
      stopPolling();
    };
  }, [allowed, id, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!allowed || !id) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => findLostDataImpl(id))
      .then(found => {
        if (cancelled) return;
        const candidates = (found && Array.isArray(found.candidates) ? found.candidates : []).filter(
          c => c && typeof c.name === "string"
        );
        const recovered = (found && Array.isArray(found.recovered) ? found.recovered : []).filter(
          r => r && typeof r.volume === "string"
        );
        for (const c of candidates) known.current[c.name] = c;
        setEntry({ candidates, recovered });
      })
      .catch(e => !cancelled && console.debug(`findLostData failed for ${id}: ${e && e.message}`));
    return () => {
      cancelled = true;
    };
  }, [allowed, id, scan]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Still copying" once the recovery has run for 10 minutes.
  useEffect(() => {
    if (!running) {
      setSlow(false);
      return undefined;
    }
    const left = running.startedAt + STILL_COPYING_AFTER_MS - Date.now();
    if (left <= 0) {
      setSlow(true);
      return undefined;
    }
    setSlow(false);
    const t = setTimeout(() => setSlow(true), left);
    return () => clearTimeout(t);
  }, [running]);

  const candidates = entry ? entry.candidates : [];
  // volume -> date recovered (null: unknown): the DAPPMANAGER's list first,
  // then the ones recovered here that it does not list yet.
  const recovered = new Map();
  for (const r of entry ? entry.recovered : []) recovered.set(r.volume, r.at == null ? null : r.at);
  for (const [volume, at] of Object.entries(doneHere)) if (!recovered.has(volume)) recovered.set(volume, at);
  const open = candidates.filter(c => !recovered.has(c.name));

  if (!allowed || !(candidates.length > 0 || running || finishedHere)) return null;

  function ask(volume) {
    confirm({
      title: "Recover the data?",
      text: CONFIRM_TEXT,
      label: "Recover data",
      variant: "primary",
      onClick: () => {
        const promise = recoverLostDataImpl(id, volume, { session });
        // Home looks again however this ends, even if the user has left this page by then.
        if (onFinished) promise.then(() => onFinished(volume), () => onFinished(volume));
        follow({ volume, promise, startedAt: Date.now() });
      },
    });
  }

  return (
    <section>
      <SectionHeader title="Data found in an unused storage volume" first />
      <Card padding="lg" className="flex flex-col gap-4">
        <p className="mb-0 text-sm text-fg-muted">
          {appTitle(dnp)} started with empty storage after an update, while its earlier data is still on this AVADO.
          Recover data copies it back. Nothing is deleted.
        </p>
        <ul className="mb-0 divide-y divide-border pl-0">
          {open.map(c => {
            const date = onDate(c.createdAt);
            const low = c.confidence === "low";
            const info = (
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-fg">{date ? `Created ${date}` : "Date unknown"}</span>
                <span className="break-words text-sm text-fg-muted">{contents(c)}</span>
              </span>
            );
            const button = (
              <Button
                variant={low ? "secondary" : "primary"}
                className={low ? "shrink-0 self-start" : "shrink-0 self-start sm:self-center"}
                loading={Boolean(running) && running.volume === c.name}
                disabled={Boolean(running)}
                onClick={() => ask(c.name)}
              >
                Recover data
              </Button>
            );
            return low ? (
              <li key={c.name} className="flex flex-col gap-3 py-3">
                {info}
                <p className="mb-0 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-warning-text">
                  {LOW_CONFIDENCE}
                </p>
                {button}
              </li>
            ) : (
              <li key={c.name} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                {info}
                {button}
              </li>
            );
          })}
          {[...recovered.entries()].map(([volume, at]) => {
            const date = onDate(at);
            const info = known.current[volume];
            return (
              <li key={volume} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium text-fg">{date ? `Recovered on ${date}` : "Recovered"}</span>
                  {info && <span className="break-words text-sm text-fg-muted">{contents(info)}</span>}
                </span>
                <Badge variant="success" className="self-start sm:self-center">
                  Recovered
                </Badge>
              </li>
            );
          })}
        </ul>
        {running && slow && (
          <div role="status" className={`rounded-md border px-3 py-2 text-sm ${NOTICE.neutral}`}>
            {STILL_COPYING}
          </div>
        )}
        {notices.map(n => (
          <div
            key={n.variant}
            role={n.variant === "danger" ? "alert" : "status"}
            className={`rounded-md border px-3 py-2 text-sm ${NOTICE[n.variant]}`}
          >
            {n.text}
          </div>
        ))}
      </Card>
    </section>
  );
}

// Container

const mapStateToProps = createStructuredSelector({
  packages: getDnpInstalled,
  // The WAMP session: a new one after every reconnect.
  session: state => (getConnectionStatus(state) || {}).session || null,
});

export default connect(mapStateToProps)(LostDataCardView);
