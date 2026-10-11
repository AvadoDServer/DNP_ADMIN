import { useState, useEffect } from "react";
import { connect } from "react-redux";
import * as action from "pages/packages/actions";
import { createStructuredSelector } from "reselect";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import { Input } from "components/ui/Input";
import Skeleton from "components/ui/Skeleton";
import { SectionHeader } from "pages/packages/components/PackagePresentation";
// Logic
import { loadRelayList } from "./relayListApi";
import {
  packageEnvs,
  parseExtraOpts,
  cardRows,
  applyRecommended,
  toEnvs,
  readMinBid,
  safeAboutUrl,
  listDate,
  sameSettings,
  MIN_BID_LOWEST,
  MIN_BID_HIGHEST,
} from "./relayConfig";

const radioClass = "h-4 w-4 shrink-0 border-border-strong text-accent focus-visible:shadow-focus disabled:cursor-not-allowed";
const checkboxClass = "mt-1 h-4 w-4 shrink-0 rounded border-border-strong text-accent focus-visible:shadow-focus";

const AMOUNT_ERROR = "Enter an amount between 0.001 and 1 ETH. Larger or smaller values can be set in the advanced settings.";

// The form as the box has it: rows ticked as in RELAYS, the minimum as in
// EXTRA_OPTS. mode is null when the card can't offer the minimum as it is
// (unreadable, or outside the amounts the card takes): then EXTRA_OPTS is
// kept whole in rest and written back unchanged.
function initialForm(envs, list) {
  const { minBid, rest } = parseExtraOpts(envs.EXTRA_OPTS);
  const offered = minBid === 0 || (minBid !== null && readMinBid(String(minBid)) === minBid);
  return {
    rows: cardRows(envs, list.relays),
    rest: offered ? rest : String(envs.EXTRA_OPTS || ""),
    mode: !offered ? null : minBid > 0 ? "above" : "every",
    amount: offered && minBid > 0 ? String(minBid) : "",
    touched: false,
  };
}

// The minimum Save writes: 0 for every bid, null to leave EXTRA_OPTS as it is.
function minBidOf(form) {
  if (form.mode === null) return null;
  return form.mode === "every" ? 0 : readMinBid(form.amount);
}

function RelayRow({ row, onToggle }) {
  const about = safeAboutUrl(row.about);
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <label className="mb-0 flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        <input type="checkbox" className={checkboxClass} checked={row.checked} onChange={onToggle} />
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-all text-sm font-medium text-fg">{row.name}</span>
          {row.filtering === "none" && <Badge>No filtering</Badge>}
          {row.filtering === "sanctions" && <Badge>Filters sanctioned transactions</Badge>}
          {row.status === "retired" && <Badge variant="warning">No longer running</Badge>}
          {row.custom && <Badge variant="accent">Custom relay</Badge>}
          {row.pubkeyMismatch && <Badge variant="warning">Key differs from the known one</Badge>}
        </span>
      </label>
      {about && (
        <a href={about} target="_blank" rel="noreferrer" aria-label={`About ${row.name}`} className="shrink-0 text-sm font-semibold text-accent hover:underline">
          About
        </a>
      )}
    </li>
  );
}

/**
 * The "Relays" card on the MEV-Boost app page: tick the relays MEV-Boost asks
 * for bids, choose a minimum bid, and save (which restarts MEV-Boost). The
 * relay list comes from relayListApi; reading and writing RELAYS and
 * EXTRA_OPTS lives in relayConfig.
 */
export function RelaysCardView({ dnp, updateEnvs }) {
  const [loaded, setLoaded] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRelayList().then(result => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const envs = packageEnvs(dnp);
  const list = loaded && loaded.list;
  // Start over whenever the box's settings change (after a save, say), not
  // on every refresh of the package list.
  const settings = `${envs.RELAYS || ""}\n${envs.EXTRA_OPTS || ""}`;
  useEffect(() => {
    if (list) setForm(initialForm(envs, list));
  }, [settings, list]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = patch => setForm(f => ({ ...f, ...patch, touched: true }));

  const ticked = form ? form.rows.filter(r => r.checked).length : 0;
  const amountOk = !form || form.mode !== "above" || readMinBid(form.amount) !== null;
  // What Save would write; Save is on only when that differs from what the box has.
  const payload = form && toEnvs(form.rows, { minBid: minBidOf(form), rest: form.rest }, envs);
  const dirty = Boolean(payload) && !sameSettings(payload, envs);
  const canSave = dirty && ticked > 0 && amountOk && !saving;

  function toggle(url) {
    update({ rows: form.rows.map(r => (r.url === url ? { ...r, checked: !r.checked } : r)) });
  }

  function useRecommended() {
    update({
      rows: applyRecommended(form.rows, list.relays),
      // Takes every bid, unless the minimum is one the card can't read.
      mode: form.mode === null ? null : "every",
    });
  }

  function save() {
    setSaving(true);
    let pending;
    try {
      pending = Promise.resolve(updateEnvs(dnp.name, payload));
    } catch (e) {
      pending = Promise.resolve();
    }
    // A failed save leaves the form as it is, ready to try again.
    pending.catch(() => {}).then(() => setSaving(false));
  }

  return (
    <section>
      <SectionHeader title="Relays" first />
      <Card padding="lg" className="flex flex-col gap-5">
        <p className="mb-0 text-sm text-fg-muted">
          Relays are where block builders send bids for the blocks your validator proposes. More working relays means
          more bids. The only thing that leaves your AVADO is your validator's public key.
        </p>

        {loaded && loaded.stale && (
          <p className="mb-0 text-sm text-warning-text">
            Showing the relay list from {listDate(list.updatedAt)}. Your AVADO could not check for a newer one.
          </p>
        )}

        {!form ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : (
          <>
            <div>
              <ul className="mb-0 divide-y divide-border pl-0">
                {form.rows.map(row => (
                  <RelayRow key={row.url} row={row} onToggle={() => toggle(row.url)} />
                ))}
              </ul>
              {ticked === 0 && form.touched && (
                <p role="status" className="mb-0 mt-2 text-sm font-medium text-danger-text">
                  Tick at least one relay.
                </p>
              )}
              {ticked === 0 && !form.touched && (
                <p className="mb-0 mt-2 text-sm text-fg-muted">No relays are set yet. Use recommended picks a good set.</p>
              )}
            </div>

            <fieldset className="flex min-w-0 flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold text-fg">Minimum bid</legend>
              <label className="mb-0 flex cursor-pointer items-center gap-3 text-sm text-fg">
                <input
                  type="radio"
                  name="minbid"
                  className={radioClass}
                  checked={form.mode === "every"}
                  disabled={form.mode === null}
                  onChange={() => update({ mode: "every" })}
                />
                Take every bid (recommended)
              </label>
              <label className="mb-0 flex cursor-pointer items-center gap-3 text-sm text-fg">
                <input
                  type="radio"
                  name="minbid"
                  className={radioClass}
                  checked={form.mode === "above"}
                  disabled={form.mode === null}
                  onChange={() => update({ mode: "above" })}
                />
                Only bids above
              </label>
              {form.mode === "above" && (
                <Input
                  type="number"
                  step="0.001"
                  min={String(MIN_BID_LOWEST)}
                  max={String(MIN_BID_HIGHEST)}
                  inputMode="decimal"
                  inputSize="sm"
                  placeholder="0.05"
                  label="Amount in ETH"
                  className="max-w-xs pl-7"
                  error={amountOk ? undefined : AMOUNT_ERROR}
                  value={form.amount}
                  onChange={e => update({ amount: e.target.value })}
                />
              )}
              {form.mode === null && (
                <p className="mb-0 text-sm text-fg-muted">A custom value is set in the advanced settings and is left as it is.</p>
              )}
              <p className="mb-0 text-sm text-fg-muted">
                With a minimum, your AVADO builds its own block whenever every bid is lower. That earns a little less and
                keeps block building more independent.
              </p>
              {form.mode !== null && form.rest && (
                <p className="mb-0 break-all text-sm text-fg-muted">
                  Other options are set and are kept as they are: {form.rest}
                </p>
              )}
            </fieldset>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={useRecommended}>
                  Use recommended
                </Button>
                <Button variant="primary" disabled={!canSave} loading={saving} onClick={save}>
                  Save
                </Button>
              </div>
              <p className="mb-0 text-xs text-fg-muted">Saving restarts MEV-Boost. Your validators keep running.</p>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

// Container

const mapStateToProps = createStructuredSelector({});

const mapDispatchToProps = {
  updateEnvs: action.updatePackageEnv,
};

export default connect(mapStateToProps, mapDispatchToProps)(RelaysCardView);
