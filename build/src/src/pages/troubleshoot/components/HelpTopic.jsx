import React from "react";
import { Link } from "react-router-dom";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { PageHeader } from "components/ui/PageHeader";
import NotFound from "components/NotFound";
import FindingRow from "components/health/FindingRow";
import { useHealth } from "health/HealthProvider";
import { TOPICS } from "../topics";
import ReportPanel from "./ReportPanel";

export default function HelpTopic({ match }) {
  const { allFindings } = useHealth();
  const topic = TOPICS.find(t => t.id === match.params.topic);

  if (!topic) return <NotFound />;

  const matches = allFindings.filter(f => topic.findingTopics.includes(f.topic));

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/help" className="hover:underline">
            Help
          </Link>
        }
        title={topic.title}
        subtitle={topic.when}
      />

      <Card padding="lg">
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">What your AVADO sees</h2>
        {matches.length ? (
          <ul className="divide-y divide-border">
            {matches.map(f => (
              <FindingRow key={f.id} finding={f} />
            ))}
          </ul>
        ) : (
          <p className="mb-0 text-sm text-success">No problems found for this topic.</p>
        )}
      </Card>

      <Card padding="lg" className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">Steps</h2>
        <ol className="flex list-decimal flex-col gap-4 pl-5">
          {topic.steps.map((step, i) => (
            <li key={i} className="pl-1">
              <p className="mb-0 font-medium text-fg">{step.title}</p>
              <p className="mb-0 mt-1 text-sm text-fg-muted">{step.body}</p>
              {step.action && (
                <Button as={Link} to={step.action.to} variant="secondary" size="sm" className="mt-2.5">
                  {step.action.label}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-fg-muted">Still stuck?</h2>
      <ReportPanel compact />
    </div>
  );
}
