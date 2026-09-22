import React from "react";
import FindingRow from "components/health/FindingRow";
import { useHealth } from "health/HealthProvider";
import Controls from "./PackageViews/Controls";
import Details from "./PackageViews/Details";

export default function AppOverview({ dnp, isCore }) {
  const { allFindings } = useHealth();
  const mine = allFindings.filter(f => f.appId === dnp.name);
  return (
    <div className="flex flex-col gap-4">
      {mine.length > 0 && (
        <section className="rounded-lg border border-border bg-surface px-4">
          <ul className="divide-y divide-border pl-0">{mine.map(f => <FindingRow key={f.id} finding={f} />)}</ul>
        </section>
      )}
      <Controls dnp={dnp} showReset={!isCore} showRemove={!isCore} showResync={false} />
      <Details dnp={dnp} />
    </div>
  );
}
