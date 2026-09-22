import PropTypes from "prop-types";
import { useEffect } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import * as s from "../selectors";
// UI kit
import Card from "components/ui/Card";
import Spinner from "components/ui/Spinner";
// Components
import { PageHeader, SectionHeader } from "./TroubleshootPresentation";
// Actions
import { fetchAllDappnodeStatus } from "services/dappnodeStatus/actions";

/** Status glyph for a single diagnose row. */
function DiagnoseIcon({ ok, loading }) {
  if (loading) return <Spinner size="sm" className="mt-0.5 text-accent" />;
  if (ok)
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  return (
    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </span>
  );
}

const RESOURCES = [
  {
    href: "https://docs.ava.do",
    label: "Docs",
    text: "Tutorials, getting started guides and information on how to set up specific packages."
  },
  {
    href: "https://www.youtube.com/avadocloud",
    label: "YouTube",
    text: "Our YouTube channel has a number of tutorial videos available. Just follow along and get set up in no time."
  },
  {
    href: "https://t.me/+a1nlCfF41gA4M2Y0",
    label: "Telegram",
    text: "Meet other AVADO users in the Telegram channel, and ask a question to a more experienced user."
  },
  {
    href: "mailto:ziga@ava.do",
    label: "ziga@ava.do",
    text: "Send an e-mail to our support team."
  }
];

function TroubleshootHome({ diagnoses, fetchAllDappnodeStatus }) {
  useEffect(() => {
    fetchAllDappnodeStatus(); // = componentDidMount
  }, []);

  const filteredDiagnoses = diagnoses.filter(
    d => !d.msg.includes("Core DNPs")
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Support"
        subtitle="Automatic health checks for your AVADO and where to get more help."
      />

      {/* Auto diagnose section */}
      <SectionHeader title="Health checks" first />
      <Card padding="none">
        <ul className="divide-y divide-border">
          {filteredDiagnoses.map(({ loading, ok, msg, solutions }, i) => (
            <li key={i} className="flex gap-3 p-4">
              <DiagnoseIcon ok={ok} loading={loading} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg">{msg}</div>
                {!ok && !loading && solutions ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-muted">
                    {solutions.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* External support */}
      <SectionHeader title="External support" />
      <Card padding="lg" className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">
          Need more help? We have the following resources available for you:
        </p>
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
    </div>
  );
}

TroubleshootHome.propTypes = {
  diagnoses: PropTypes.array.isRequired,
  issueBody: PropTypes.string.isRequired,
  issueUrl: PropTypes.string.isRequired,
  issueUrlRaw: PropTypes.string.isRequired
};

// Container

const mapStateToProps = createStructuredSelector({
  issueBody: s.getIssueBody,
  issueUrl: s.getIssueUrl,
  issueUrlRaw: s.getIssueUrlRaw,
  diagnoses: s.getDiagnoses
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = { fetchAllDappnodeStatus };

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TroubleshootHome);
