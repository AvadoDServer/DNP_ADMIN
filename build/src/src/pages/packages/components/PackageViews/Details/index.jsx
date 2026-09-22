import React from "react";
// UI kit
import Card from "components/ui/Card";
import { SectionHeader } from "../../PackagePresentation";
// This
import Links from "./Links";
import Ports from "./Ports";
import Vols from "./Vols";
import StateBadge from "../StateBadge";

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
          <div className="flex items-center gap-2">
            <span className="text-fg-subtle">Version</span>
            <span className="font-medium text-fg">
              {version} {origin || ""}
            </span>
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
