import { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
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
import { findLostData, recoverLostData } from "../lostDataApi";

const CONFIRM_TEXT =
  "This copies the files from the old storage into the app's storage. Files that are already there are kept. The app restarts; this can take a few minutes. Nothing is deleted.";

const NOTICE = {
  success: "border-success/40 bg-success-subtle text-success-text",
  danger: "border-danger/40 bg-danger-subtle text-danger-text",
};

// "March 1, 2025" (read as UTC, like the relay list date), or null.
function createdOn(value) {
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

// The candidates to show: the latest scan's, plus any recovered here that the
// scan no longer lists (so "Recovered" does not vanish with the notice).
function mergeRows(previous, next, recovered) {
  const names = new Set(next.map(c => c.name));
  const kept = previous.filter(c => recovered[c.name] !== undefined && !names.has(c.name));
  return [...next, ...kept];
}

/**
 * "Data found in an unused storage volume", on every app's overview: the
 * app's data in a storage volume no container uses (left behind by an
 * update, say), and a one-click "Recover data" that copies it back.
 * DAPPMANAGER 10.0.51 and newer only; with an older one, or on a core
 * package, the card renders nothing and makes no call. Hidden until the scan
 * finds something.
 */
export function LostDataCardView({
  dnp,
  packages,
  onRecovered,
  findLostDataImpl = findLostData,
  recoverLostDataImpl = recoverLostData,
}) {
  // Core packages are left out: listLostData skips them and recoverLostData refuses them.
  const allowed = canFindLostData(packages) && !(dnp && dnp.isCore);
  const id = dnp && dnp.name;
  const [rows, setRows] = useState([]);
  // volume -> files recovered, for the rows recovered on this page
  const [recovered, setRecovered] = useState({});
  const [running, setRunning] = useState(null);
  const [notice, setNotice] = useState(null);
  const [scan, setScan] = useState(0);
  const mounted = useRef(true);
  const recoveredRef = useRef(recovered);
  recoveredRef.current = recovered;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!allowed || !id) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => findLostDataImpl(id))
      .then(entry => {
        if (cancelled) return;
        const next = (entry && Array.isArray(entry.candidates) ? entry.candidates : []).filter(
          c => c && typeof c.name === "string"
        );
        setRows(prev => mergeRows(prev, next, recoveredRef.current));
      })
      .catch(e => !cancelled && console.debug(`findLostData failed for ${id}: ${e && e.message}`));
    return () => {
      cancelled = true;
    };
  }, [allowed, id, scan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!allowed || rows.length === 0) return null;

  function recover(volume) {
    setRunning(volume);
    setNotice(null);
    Promise.resolve()
      .then(() => recoverLostDataImpl(id, volume))
      .then(
        result => {
          if (!mounted.current) return;
          const files = result && Number.isFinite(Number(result.files)) ? Number(result.files) : 0;
          setRecovered(r => ({ ...r, [volume]: files }));
          setNotice({ variant: "success", text: `Done: ${files} files recovered. The app is starting again.` });
          if (onRecovered) onRecovered(volume);
          setScan(s => s + 1);
        },
        e => {
          if (!mounted.current) return;
          setNotice({ variant: "danger", text: (e && e.message) || "Recovering the data failed. Try again." });
        }
      )
      .then(() => mounted.current && setRunning(null));
  }

  function ask(volume) {
    confirm({
      title: "Recover the data?",
      text: CONFIRM_TEXT,
      label: "Recover data",
      onClick: () => recover(volume),
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
          {rows.map(c => {
            const date = createdOn(c.createdAt);
            const done = recovered[c.name] !== undefined;
            return (
              <li key={c.name} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium text-fg">{date ? `Created ${date}` : "Date unknown"}</span>
                  <span className="break-words text-sm text-fg-muted">{contents(c)}</span>
                </span>
                {done ? (
                  <Badge variant="success" className="self-start sm:self-center">
                    Recovered
                  </Badge>
                ) : (
                  <Button
                    variant="primary"
                    className="shrink-0 self-start sm:self-center"
                    loading={running === c.name}
                    disabled={running !== null}
                    onClick={() => ask(c.name)}
                  >
                    Recover data
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {notice && (
          <div
            role={notice.variant === "danger" ? "alert" : "status"}
            className={`rounded-md border px-3 py-2 text-sm ${NOTICE[notice.variant]}`}
          >
            {notice.text}
          </div>
        )}
      </Card>
    </section>
  );
}

// Container

const mapStateToProps = createStructuredSelector({
  packages: getDnpInstalled,
});

export default connect(mapStateToProps)(LostDataCardView);
