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
  MIN_BID_LOWEST,
  MIN_BID_HIGHEST,
} from "./relayConfig";

const radioClass = "h-4 w-4 shrink-0 border-border-strong text-accent focus-visible:shadow-focus disabled:cursor-not-allowed";
const checkboxClass = "mt-1 h-4 w-4 shrink-0 rounded border-border-strong text-accent focus-visible:shadow-focus";

// The form as the box has it: rows ticked as in RELAYS, the minimum as in
// EXTRA_OPTS. mode is null when the minimum can't be read (left as it is).
function initialForm(envs, list) {
  const { minBid, rest } = parseExtraOpts(envs.EXTRA_OPTS);
  return {
    rows: cardRows(envs, list.relays),
    rest,
    mode: minBid === null ? null : minBid > 0 ? "above" : "every",
    amount: minBid > 0 ? String(minBid) : "",
    dirty: false,
  };
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
        <a href={about} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-accent hover:underline">
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

  const update = patch => setForm(f => ({ ...f, ...patch, dirty: true }));

  const ticked = form ? form.rows.filter(r => r.checked).length : 0;
  const amountOk = !form || form.mode !== "above" || readMinBid(form.amount) !== null;
  const canSave = Boolean(form) && form.dirty && ticked > 0 && amountOk;

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
    const minBid = form.mode === null ? null : form.mode === "every" ? 0 : readMinBid(form.amount);
    updateEnvs(dnp.name, toEnvs(form.rows, { minBid, rest: form.rest }, packageEnvs(dnp)));
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
              {ticked === 0 && <p className="mb-0 mt-2 text-sm font-medium text-danger-text">Tick at least one relay.</p>}
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
                  <span className="flex items-center gap-2 pl-7 sm:pl-0">
                    <Input
                      type="number"
                      step="0.01"
                      min={String(MIN_BID_LOWEST)}
                      max={String(MIN_BID_HIGHEST)}
                      inputMode="decimal"
                      inputSize="sm"
                      placeholder="0.05"
                      aria-label="Minimum bid in ETH"
                      className="w-28"
                      value={form.amount}
                      onChange={e => update({ amount: e.target.value })}
                    />
                    <span className="text-sm text-fg-muted">ETH</span>
                  </span>
                )}
              </div>
              {!amountOk && <p className="mb-0 text-sm font-medium text-danger-text">Enter an amount from 0.001 to 1 ETH.</p>}
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
                <Button variant="primary" disabled={!canSave} onClick={save}>
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
