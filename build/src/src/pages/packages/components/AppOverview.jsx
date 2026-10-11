import React from "react";
import FindingRow from "components/health/FindingRow";
import { useHealth } from "health/HealthProvider";
import Controls from "./PackageViews/Controls";
import Details from "./PackageViews/Details";
import LostDataCard from "./LostDataCard";
import RelaysCard from "pages/packages/apps/mevboost/RelaysCard";
import { MEVBOOST_PACKAGE } from "health/clients";

// The lost-data findings point here; the card above shows them in full.
const isLostData = f => typeof f.id === "string" && f.id.startsWith("lost-data:");

export default function AppOverview({ dnp, isCore }) {
  const { allFindings, dismiss } = useHealth();
  const mine = allFindings.filter(f => f.appId === dnp.name && !isLostData(f));
  // Once recovered, the old volume stays where it was (nothing is deleted), so
  // the DAPPMANAGER keeps listing it: hide its Home finding.
  const onRecovered = volume => dismiss && dismiss(`lost-data:${dnp.name}:${volume}`);
  return (
    <div className="flex flex-col gap-4">
      <LostDataCard dnp={dnp} onRecovered={onRecovered} />
      {dnp.name === MEVBOOST_PACKAGE && <RelaysCard dnp={dnp} />}
      {mine.length > 0 && (
        <section className="rounded-lg border border-border bg-surface px-4">
          <ul className="divide-y divide-border pl-0">{mine.map(f => <FindingRow key={f.id} finding={f} />)}</ul>
        </section>
      )}
      <Controls dnp={dnp} isCore={isCore} showReset={!isCore} showRemove={!isCore} showResync={false} />
      <Details dnp={dnp} />
    </div>
  );
}
