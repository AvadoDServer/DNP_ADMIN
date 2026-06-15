import React, { useState, useEffect, useCallback } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
import {
  Card,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  Spinner
} from "components/ui";
import { getStatus, activateSubscription } from "../priorityApi";

/**
 * Priority Support page.
 * Shows the box's subscription status and lets the user activate a purchased
 * code against the avado-priority-support backend (see ../priorityApi). The box
 * is identified to the backend by its DAppNode node id.
 */

const BENEFITS = [
  "Priority email support with 24-hour response time",
  "Access to private support channels",
  "Personal 1-on-1 support sessions",
  "Advanced troubleshooting assistance",
  "Configuration optimization support",
  "Expert guidance for complex setups"
];

const CheckIcon = () => (
  <svg
    className="mt-0.5 h-4 w-4 shrink-0 text-success"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function BenefitList({ items }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map(benefit => (
        <li key={benefit} className="flex items-start gap-2.5 text-sm text-fg-muted">
          <CheckIcon />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function Priority({ dappnodeParams = {} }) {
  const userId = dappnodeParams.nodeid || dappnodeParams.name || "";
  const isMock = Boolean(import.meta.env.REACT_APP_MOCK_DATA);

  const [subscription, setSubscription] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStatus = useCallback(async () => {
    if (!userId && !isMock) {
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    try {
      const res = await getStatus(userId);
      setSubscription(res && res.hasSubscription ? res.subscription : null);
    } catch (e) {
      // A failed status check shouldn't block the activation UI.
      setSubscription(null);
    } finally {
      setStatusLoading(false);
    }
  }, [userId, isMock]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleActivate = async () => {
    if (!code.trim()) {
      setError("Please enter a subscription code");
      return;
    }
    if (!userId && !isMock) {
      setError("Box identity is not available yet — please try again in a moment.");
      return;
    }
    setActivating(true);
    setError("");
    setSuccess("");
    try {
      const res = await activateSubscription(userId, code.trim());
      setSubscription(res.subscription);
      setSuccess("Subscription activated successfully!");
      setCode("");
    } catch (e) {
      setError(e.message || "Could not activate subscription. Please try again.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-fg">Priority Support</h1>
        <p className="text-sm text-fg-muted">
          Get faster, dedicated help from the AVADO team for your node.
        </p>
      </header>

      {statusLoading ? (
        <Card className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </Card>
      ) : subscription ? (
        <Card padding="lg" className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Active subscription</CardTitle>
            <Badge variant="success" dot>
              Active
            </Badge>
          </div>
          <p className="text-sm text-fg-muted">
            Your priority support subscription is active.
          </p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {subscription.planType && (
              <div className="rounded-md border border-border bg-bg-subtle p-3">
                <dt className="text-xs uppercase tracking-wide text-fg-subtle">Plan</dt>
                <dd className="mt-0.5 text-sm font-medium capitalize text-fg">
                  {subscription.planType}
                </dd>
              </div>
            )}
            {subscription.endDate && (
              <div className="rounded-md border border-border bg-bg-subtle p-3">
                <dt className="text-xs uppercase tracking-wide text-fg-subtle">Expires</dt>
                <dd className="mt-0.5 text-sm font-medium text-fg">
                  {formatDate(subscription.endDate)}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-fg">Your benefits</h3>
            <BenefitList items={BENEFITS.slice(0, 5)} />
          </div>
          <p className="text-sm text-fg-muted">
            Need help? Contact our priority support team at{" "}
            <a className="font-medium text-accent hover:underline" href="mailto:priority@avado.cloud">
              priority@avado.cloud
            </a>
            .
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">Upgrade to Priority Support</CardTitle>
              <CardDescription>
                Everything you need to keep your node running smoothly, backed by the AVADO team.
              </CardDescription>
            </div>
            <BenefitList items={BENEFITS} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg-subtle p-4">
                <div className="text-xl font-bold text-fg">€12<span className="text-sm font-normal text-fg-muted">/month</span></div>
                <div className="mt-0.5 text-sm text-fg-muted">Monthly subscription</div>
              </div>
              <div className="relative rounded-lg border border-accent/60 bg-accent/[0.06] p-4">
                <Badge variant="accent" className="absolute -top-2.5 right-3">
                  Best value
                </Badge>
                <div className="text-xl font-bold text-fg">€100<span className="text-sm font-normal text-fg-muted">/year</span></div>
                <div className="mt-0.5 text-sm text-fg-muted">Annual subscription — save €44</div>
              </div>
            </div>

            <a href="https://ava.do/shop" target="_blank" rel="noopener noreferrer" className="self-start">
              <Button>Visit AVADO Shop</Button>
            </a>
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Activate your subscription</CardTitle>
              <CardDescription>
                Already purchased? Enter your subscription code to activate priority support.
              </CardDescription>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                role="status"
                className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              >
                {success}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                className="flex-1"
                label="Subscription code"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && !activating && handleActivate()}
                disabled={activating}
                autoComplete="off"
                spellCheck={false}
              />
              <Button onClick={handleActivate} loading={activating} className="sm:w-32">
                {activating ? "Activating" : "Activate"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  dappnodeParams: getDappnodeParams
});

export default connect(mapStateToProps)(Priority);
