import React from "react";
import { Link } from "react-router-dom";
import Card from "components/ui/Card";
import { PageHeader, SectionHeader } from "components/ui/PageHeader";
import { cn } from "components/ui/cn";
import { useHealth } from "health/HealthProvider";
import { TOPICS } from "../topics";
import ReportPanel from "./ReportPanel";

const RESOURCES = [
  {
    href: "https://docs.ava.do",
    label: "Docs",
    text: "Tutorials, getting started guides and information on how to set up specific packages.",
  },
  {
    href: "https://www.youtube.com/avadocloud",
    label: "YouTube",
    text: "Our YouTube channel has a number of tutorial videos available. Just follow along and get set up in no time.",
  },
  {
    href: "https://t.me/+a1nlCfF41gA4M2Y0",
    label: "Telegram",
    text: "Meet other AVADO users in the Telegram channel, and ask a question to a more experienced user.",
  },
];

const DOT = { critical: "bg-danger", warning: "bg-warning", ok: "bg-success" };
const DOT_LABEL = { critical: "Action required", warning: "Needs attention", ok: "All good" };

function severityFor(findingTopics, allFindings) {
  const matches = (allFindings || []).filter(f => findingTopics.includes(f.topic));
  if (matches.some(f => f.severity === "critical")) return "critical";
  if (matches.some(f => f.severity === "warning")) return "warning";
  return "ok";
}

export default function HelpHome() {
  const { allFindings } = useHealth();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Help" subtitle="Find what's wrong and fix it, or get in touch with us." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map(topic => {
          const severity = severityFor(topic.findingTopics, allFindings);
          return (
            <Card
              key={topic.id}
              as={Link}
              to={`/help/${topic.id}`}
              interactive
              className="flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="mb-0 min-w-0 break-words font-display text-base font-semibold text-fg">
                  {topic.title}
                </h3>
                <span
                  className={cn("mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full", DOT[severity])}
                  aria-hidden="true"
                />
                <span className="sr-only">{DOT_LABEL[severity]}</span>
              </div>
              <p className="mb-0 text-sm text-fg-muted">{topic.when}</p>
            </Card>
          );
        })}
      </div>

      <ReportPanel />

      <SectionHeader title="Community" />
      <Card padding="lg">
        <ul className="flex flex-col gap-3">
          {RESOURCES.map(({ href, label, text }) => (
            <li key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 font-semibold text-accent transition-colors hover:text-accent-hover"
              >
                {label}
              </a>
              <span className="text-sm text-fg-muted">{text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-4 text-sm text-fg-muted">
        Priority support subscribers get faster answers — manage it in{" "}
        <Link to="/priority" className="font-medium text-accent hover:underline">
          Priority
        </Link>
        .
      </p>
    </div>
  );
}
