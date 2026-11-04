import React from "react";
import { toast } from "react-toastify";
// UI kit
import Card from "components/ui/Card";
import { SectionHeader } from "../../PackagePresentation";
// This
import Links from "./Links";
import Ports from "./Ports";
import Vols from "./Vols";
import StateBadge from "../StateBadge";
import copyText from "utils/copyText";

/**
 * "Qm12…ab34" for a package installed from an IPFS hash (the full hash made
 * the page scroll sideways on a phone), with a button that copies all of it.
 * @param {string} origin "/ipfs/Qm…" or "Qm…"
 * @returns {string}
 */
export function shortOrigin(origin) {
  const s = String(origin || "").replace(/^\/ipfs\//, "");
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

function copyOrigin(origin) {
  copyText(origin).then(
    () => toast("Copied"),
    () => toast("Could not copy")
  );
}

function Origin({ origin }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="font-mono text-xs text-fg-muted" title={origin}>
        {shortOrigin(origin)}
      </span>
      <button
        type="button"
        onClick={() => copyOrigin(origin)}
        aria-label="Copy the full IPFS hash"
        title="Copy the full IPFS hash"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-fg/[0.06] hover:text-fg focus:outline-none focus-visible:shadow-focus"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </span>
  );
}

function PackageDetails({ dnp }) {
  if (!dnp) return null;
  const { manifest, state } = dnp;
  const { description, version, origin } = manifest || {};
  return (
    <section>
      <SectionHeader title="Details" />
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-fg-subtle">Status</span>
            <StateBadge state={state} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-fg-subtle">Version</span>
            {version && <span className="font-medium text-fg">{version}</span>}
            {origin && <Origin origin={origin} />}
          </div>
        </div>

        {description && (
          <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
        )}

        <div className="grid grid-cols-1 gap-6 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Links dnp={dnp} />
          <Ports dnp={dnp} />
          <Vols dnp={dnp} />
        </div>
      </Card>
    </section>
  );
}

export default PackageDetails;
