import React, { useState, useEffect, useCallback, useRef } from "react";
import { connect } from "react-redux";
import { useLocation, useHistory } from "react-router-dom";
import { createStructuredSelector } from "reselect";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
import {
  Card,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Spinner,
  PageHeader
} from "components/ui";
import {
  getStatus,
  createCheckout,
  createPortal,
  NODE_ID_REGEX
} from "../priorityApi";
import CareSection from "./CareSection";
import Notice from "./Notice";

/**
 * Priority Care page.
 * Shows the box's subscription status, starts a Stripe Checkout to subscribe and
 * opens the Stripe Customer Portal to manage billing (see ../priorityApi). The
 * subscription belongs to the box, identified by its DAppNode node id.
 * Subscribers also get the Priority Care alerts (see ./CareSection).
 */

export const BENEFITS = [
  "Priority email support with 24-hour response time",
  "Access to private support channels",
  "Personal 1-on-1 support sessions",
  "An email when your AVADO goes offline, and another when it is back",
  "Your AVADO checks itself every 10 minutes and emails you about serious problems, like a stopped app, a full disk, a missing fee recipient or an update that can't install",
  "A warning when a version you run has a known problem or a network upgrade deadline is close",
  "A monthly health report in plain language",
  "A reply within 8 business hours when your AVADO is down",
  "Two check-ups a year and one guided move to new hardware a year",
  "10% off AVADO hardware"
];

// After Stripe sends the browser back, the subscription arrives by webhook a
// moment later: poll the status instead of showing "not subscribed".
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

const CheckIcon = () => (
  <svg
    className="mt-0.5 h-4 w-4 shrink-0 text-success-text"
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
  const isMock = Boolean(import.meta.env.REACT_APP_MOCK_DATA);
  // Only the node id identifies a box. The box name is the same on every AVADO.
  const nodeId = NODE_ID_REGEX.test(dappnodeParams.nodeid || "")
    ? dappnodeParams.nodeid
    : "";
  const identityReady = Boolean(nodeId) || isMock;

  const location = useLocation();
  const history = useHistory();
  const checkoutResult = new URLSearchParams(location.search).get("checkout");

  const [subscription, setSubscription] = useState(null);
  const [trialEligible, setTrialEligible] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(""); // "monthly" | "yearly" | "portal"
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadStatus = useCallback(async () => {
    const res = await getStatus(nodeId);
    const current = res && res.hasSubscription ? res.subscription : null;
    if (mounted.current) {
      setSubscription(current);
      setTrialEligible(Boolean(res && res.trialEligible === true));
    }
    return current;
  }, [nodeId]);

  // Initial load
  useEffect(() => {
    if (!identityReady) {
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    setStatusError("");
    loadStatus()
      .catch(e => mounted.current && setStatusError(e.message))
      .finally(() => mounted.current && setStatusLoading(false));
  }, [identityReady, loadStatus]);

  // Back from Stripe
  useEffect(() => {
    if (!checkoutResult || !identityReady) return;
    history.replace(location.pathname);

    if (checkoutResult !== "success") {
      setNotice("Checkout cancelled. No payment was taken.");
      return;
    }

    // No effect cleanup here: history.replace above clears checkoutResult, which
    // re-runs this effect, and a cleanup would cancel the polling just started.
    // Polling ends on its own and stops when the page unmounts.
    const startedAt = Date.now();
    setConfirming(true);
    (async function poll() {
      const current = await loadStatus().catch(() => null);
      if (!mounted.current) return;
      if (current) {
        setConfirming(false);
        setNotice("Thank you! Priority Care is now active on this AVADO.");
      } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setConfirming(false);
        setNotice(
          "Your payment was received. Activation is taking longer than usual, reload this page in a few minutes. If it still shows no subscription, contact support and mention your node ID."
        );
      } else {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    })();
    // Runs once per return from Stripe; history.replace clears checkoutResult
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutResult, identityReady]);

  const goTo = async (what, getUrl) => {
    if (!identityReady) {
      setError("Box identity is not available yet. Please try again in a moment.");
      return;
    }
    setBusy(what);
    setError("");
    setNotice("");
    try {
      window.location.assign(await getUrl());
      // Leaving the page; keep the button busy until the browser navigates.
      // The mock never leaves, it only changes the hash.
      if (isMock && mounted.current) {
        setBusy("");
        loadStatus().catch(() => {});
      }
    } catch (e) {
      if (!mounted.current) return;
      setBusy("");
      if (e.code === "already_subscribed") {
        loadStatus().catch(() => {});
        setNotice("This AVADO already has an active subscription.");
      } else {
        setError(e.message || "Something went wrong. Please try again.");
      }
    }
  };
  const subscribe = plan => goTo(plan, () => createCheckout(nodeId, plan));
  const manageBilling = () => goTo("portal", () => createPortal(nodeId));

  const pastDue = subscription && subscription.status === "past_due";
  const trialing = subscription && subscription.status === "trialing";
  const cancelling = subscription && subscription.cancelAtPeriodEnd;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Priority Care"
        subtitle="AVADO keeps an eye on your box and helps you first when something goes wrong."
      />
      <div className="flex w-full flex-col gap-6">

      {notice && <Notice variant="success">{notice}</Notice>}
      {error && <Notice variant="danger">{error}</Notice>}

      {statusLoading || confirming ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16">
          <Spinner size="lg" />
          {confirming && (
            <p className="text-sm text-fg-muted">Confirming your payment…</p>
          )}
        </Card>
      ) : subscription ? (
        <Card padding="lg" className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Your subscription</CardTitle>
            {pastDue ? (
              <Badge variant="warning" dot>
                Payment problem
              </Badge>
            ) : cancelling ? (
              <Badge variant="neutral">Cancelled</Badge>
            ) : trialing ? (
              <Badge variant="accent" dot>
                Free trial
              </Badge>
            ) : (
              <Badge variant="success" dot>
                Active
              </Badge>
            )}
          </div>

          {pastDue && (
            <Notice variant="warning">
              Your last payment failed. Priority Care stays active while we retry.
              Please update your payment method under Manage billing.
            </Notice>
          )}

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {subscription.planType && (
              <div className="rounded-md border border-border bg-bg-subtle p-3">
                <dt className="text-xs text-fg-subtle">Plan</dt>
                <dd className="mt-0.5 text-sm font-medium capitalize text-fg">
                  {subscription.planType}
                </dd>
              </div>
            )}
            {subscription.endDate && (
              <div className="rounded-md border border-border bg-bg-subtle p-3">
                <dt className="text-xs text-fg-subtle">
                  {cancelling ? "Ends on" : trialing ? "Trial ends on" : "Renews on"}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-fg">
                  {formatDate(subscription.endDate)}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg-muted">
              {cancelling
                ? "Your subscription will not renew. You can resume it any time before it ends."
                : "Update your payment method, download invoices or cancel."}
            </p>
            <Button
              variant="outline"
              onClick={manageBilling}
              loading={busy === "portal"}
              disabled={Boolean(busy)}
              className="shrink-0"
            >
              Manage billing
            </Button>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-fg">Your benefits</h3>
            <BenefitList items={BENEFITS} />
          </div>
          <p className="text-sm text-fg-muted">
            Need help? Contact the AVADO Priority Care team at{" "}
            <a className="font-medium text-accent hover:underline" href="mailto:ziga@ava.do">
              ziga@ava.do
            </a>
            .
          </p>
        </Card>
      ) : (
        <Card padding="lg" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">
              {trialEligible ? "Try Priority Care free for 14 days" : "Get Priority Care"}
            </CardTitle>
            <CardDescription>
              AVADO watches your box for you, tells you when something needs attention and
              helps you first.
            </CardDescription>
          </div>
          <BenefitList items={BENEFITS} />
          <p className="text-xs text-fg-subtle">
            Always free for everyone: the health checks and fix buttons in this Admin, security
            and network upgrade updates, and basic support.
          </p>

          {trialEligible && (
            <Notice variant="success">
              Your first 14 days are free. Pick a plan below; you are only charged when the trial
              ends, and you can cancel any time before that.
            </Notice>
          )}

          {statusError && (
            <Notice variant="warning">
              The subscription service could not be reached ({statusError}). Check this
              AVADO&apos;s internet connection and reload the page.
            </Notice>
          )}
          {!identityReady && (
            <Notice variant="neutral">
              Waiting for this AVADO&apos;s identity. Subscribing becomes available once the
              connection to your AVADO is established.
            </Notice>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-subtle p-4">
              <div>
                <div className="text-xl font-bold text-fg">
                  €12<span className="text-sm font-normal text-fg-muted">/month</span>
                </div>
                <div className="mt-0.5 text-sm text-fg-muted">
                  {trialEligible ? "Billed monthly after the free trial" : "Billed monthly"}
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-auto w-full"
                onClick={() => subscribe("monthly")}
                loading={busy === "monthly"}
                disabled={Boolean(busy) || !identityReady}
              >
                {trialEligible ? "Start free trial, monthly" : "Subscribe monthly"}
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-accent/60 bg-accent/[0.06] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-fg">
                    €120<span className="text-sm font-normal text-fg-muted">/year</span>
                  </div>
                  <div className="mt-0.5 text-sm text-fg-muted">
                    {trialEligible ? "Billed yearly after the free trial, save €24" : "Billed yearly, save €24"}
                  </div>
                </div>
                <Badge variant="accent">Best value</Badge>
              </div>
              <Button
                className="mt-auto w-full"
                onClick={() => subscribe("yearly")}
                loading={busy === "yearly"}
                disabled={Boolean(busy) || !identityReady}
              >
                {trialEligible ? "Start free trial, yearly" : "Subscribe yearly"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-fg-subtle">
            Secure payment by Stripe. The subscription is linked to this AVADO and renews
            automatically. Cancel any time from this page.
          </p>
        </Card>
      )}

      {subscription && !statusLoading && !confirming && identityReady && (
        <CareSection nodeId={nodeId} />
      )}
      </div>
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  dappnodeParams: getDappnodeParams
});

export default connect(mapStateToProps)(Priority);
