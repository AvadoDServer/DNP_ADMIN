import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useHistory } from "react-router-dom";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappmanagerVersionData } from "services/dappnodeStatus/selectors";
import { canUsePushAlerts, pushAlertsNeedUpdate } from "health/clients";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { PageHeader } from "components/ui/PageHeader";
import { isSecurePage, isBoxHostname, secureUrlForHere, SECURE_HOST } from "utils/boxUrls";
import { isApple, isPhone, isStandalone, platform, pushSupported, promptInstall, useInstallPrompt } from "./device";
import { readState, turnOn, turnOff, sendTest, TEXTS } from "./pushApi";

/**
 * Alerts on this phone: one switch ("Send alerts to this phone") and a test
 * button. On System > Overview and on its own page (/system/alerts, for
 * Simple mode too). Home shows a short hint on phones to add AVADO to the
 * home screen and turn alerts on.
 */

export const ALERTS_PATH = "/system/alerts";
export const TEST_SENT_TEXT = "Test alert sent. It should show up on this device within a minute.";
export const WHAT_TEXT = "You get an alert when a client stops working, the disk is nearly full, validators have no fee recipient or miss attestations.";

function useAlertsGate() {
  const packages = useSelector(getDnpInstalled) || [];
  const versionData = useSelector(getDappmanagerVersionData);
  const own = versionData && versionData.version;
  return { allowed: canUsePushAlerts(packages, own), needsUpdate: pushAlertsNeedUpdate(packages, own) };
}

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 ${
        checked ? "border-accent bg-accent" : "border-border bg-bg-subtle"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full bg-surface shadow transition-transform duration-150 ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

/** Why this browser cannot turn alerts on here, as { text, action }; null if it can */
export function blocker({ secure, boxHost, apple, standalone, supported }) {
  if (!secure)
    return boxHost
      ? { text: "Alerts and the home-screen app need your AVADO's secure address.", action: "secure" }
      : { text: `Alerts need your AVADO's secure address: open https://${SECURE_HOST} on this device while it is on your AVADO's Wi-Fi or VPN.` };
  if (apple && !standalone)
    return { text: "On iPhone and iPad, add AVADO to your Home Screen first: tap the Share button, then Add to Home Screen. Open AVADO from there and turn alerts on." };
  if (!supported) return { text: "This browser cannot get alerts. Use Chrome on Android, Safari on iPhone (from the Home Screen) or a computer's browser." };
  return null;
}

function Message({ kind, children }) {
  const style = kind === "error" ? "bg-danger-subtle text-danger-text" : kind === "ok" ? "bg-success-subtle text-success-text font-medium" : "bg-bg-subtle text-fg";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`mb-0 rounded-md px-3 py-2 text-sm ${style}`}>
      {children}
    </p>
  );
}

export function AlertsCard({ env, api }) {
  const { allowed, needsUpdate } = useAlertsGate();
  const e = env || {
    secure: isSecurePage(),
    boxHost: isBoxHostname(),
    apple: isApple(),
    standalone: isStandalone(),
    supported: pushSupported()
  };
  const impl = api || { readState, turnOn, turnOff, sendTest };
  const block = blocker(e);
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (block || !allowed) return;
    let live = true;
    impl
      .readState()
      .then(s => live && setOn(s.on))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
  }, [allowed, Boolean(block)]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(
    async next => {
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        if (next) await impl.turnOn();
        else await impl.turnOff();
        setOn(next);
        if (next) setNote("Alerts are on for this device.");
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [impl]
  );

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await impl.sendTest();
      setNote(TEST_SENT_TEXT);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [impl]);

  return (
    <Card as="section" aria-labelledby="phone-alerts-title" padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 id="phone-alerts-title" className="mb-1 font-display text-lg font-semibold text-fg">
          Alerts on this phone
        </h2>
        <p className="mb-0 text-sm text-fg-muted">{WHAT_TEXT}</p>
      </div>
      {needsUpdate ? (
        <p className="mb-0 text-sm text-fg">
          {TEXTS.oldCore}{" "}
          <Link to="/system/updates" className="font-semibold text-accent hover:underline">
            Open Updates
          </Link>
        </p>
      ) : block ? (
        <div className="flex flex-col gap-3">
          <p className="mb-0 text-sm text-fg">{block.text}</p>
          {block.action === "secure" && (
            <Button as="a" href={secureUrlForHere()} className="w-full sm:w-auto sm:self-start">
              Open the secure address
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <span id="phone-alerts-switch" className="text-sm font-medium text-fg">
              Send alerts to this phone
            </span>
            <Switch checked={Boolean(on)} disabled={busy || on === null || !allowed} onChange={toggle} label="Send alerts to this phone" />
          </div>
          {on && (
            <Button variant="secondary" loading={busy} onClick={test} className="w-full sm:w-auto sm:self-start">
              Send a test alert
            </Button>
          )}
          {error && <Message kind="error">{error}</Message>}
          {note && !error && <Message kind="ok">{note}</Message>}
        </>
      )}
    </Card>
  );
}

/** /system/alerts: the card on its own page, for Simple mode too */
export function AlertsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Alerts" subtitle="Hear about problems on your phone, wherever you are." />
      <AlertsCard />
    </div>
  );
}

/* ---------------- Home: add to home screen ---------------- */

const HINT_KEY = "avado.homeScreenHint.dismissed";

function hintDismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch (err) {
    return false;
  }
}

function dismissHint() {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch (err) {
    // shown again next time
  }
}

/** What the hint says and offers, or null when it should not show */
export function hintFor({ phone, secure, boxHost, standalone, apple, android, canPrompt }) {
  if (!phone) return null;
  if (standalone) return { text: "Get an alert on this phone when something on your AVADO needs you.", action: "alerts", label: "Turn on alerts" };
  if (!secure) return boxHost ? { text: "Add AVADO to your home screen and get alerts on this phone.", action: "secure", label: "Get started" } : null;
  if (canPrompt) return { text: "Add AVADO to your home screen, then turn on alerts.", action: "install", label: "Add to Home Screen" };
  if (apple) return { text: "Add AVADO to your Home Screen: tap the Share button, then Add to Home Screen. Then open it from there." };
  if (android) return { text: "Add AVADO to your home screen: open the browser menu (⋮) and choose Add to Home screen." };
  return null;
}

export function HomeScreenHint({ env }) {
  const history = useHistory();
  const { allowed } = useAlertsGate();
  const prompt = useInstallPrompt();
  const [dismissed, setDismissed] = useState(hintDismissed);
  const p = platform();
  const e = env || {
    phone: isPhone(p),
    secure: isSecurePage(),
    boxHost: isBoxHostname(),
    standalone: isStandalone(),
    apple: isApple(p),
    android: p === "android",
    canPrompt: Boolean(prompt)
  };
  const hint = hintFor(e);
  // Only once the box can send alerts: the hint promises them
  if (!allowed || dismissed || !hint) return null;
  const act = async () => {
    if (hint.action === "secure") window.location.href = secureUrlForHere();
    else if (hint.action === "alerts") history.push(ALERTS_PATH);
    else if (hint.action === "install") await promptInstall();
  };
  return (
    <Card
      as="section"
      aria-labelledby="home-screen-hint-title"
      padding="md"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <h2 id="home-screen-hint-title" className="mb-1 font-display text-base font-semibold text-fg">
          AVADO on your phone
        </h2>
        <p className="mb-0 text-sm text-fg-muted">{hint.text}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {hint.label && (
          <Button size="sm" onClick={act}>
            {hint.label}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            dismissHint();
            setDismissed(true);
          }}
        >
          Not now
        </Button>
      </div>
    </Card>
  );
}
