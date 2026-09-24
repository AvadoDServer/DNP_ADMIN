import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useHealth } from "health/HealthProvider";
import { storeHashFor } from "pages/installer/helpers/storeHash";
import { Card, CardTitle, CardDescription, Button, Badge, Spinner, Input } from "components/ui";
import {
  CARE_PACKAGE,
  PREF_KEYS,
  getCareSettings,
  setCareSettings,
  getCareStatus
} from "../careApi";
import Notice from "./Notice";

/**
 * Priority Care for subscribers: install the Care app ("Turn on alerts"),
 * "AVADO is watching your box", the alerts email and the alert categories.
 */

const STATUS_POLL_MS = 60 * 1000;
// A heartbeat is sent every 10 minutes; older than this is worth a word.
const STALE_HEARTBEAT_MS = 30 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CATEGORIES = [
  {
    key: "offline",
    title: "My AVADO goes offline",
    description: "When your box stops checking in for an hour, and again when it is back."
  },
  {
    key: "critical",
    title: "Serious problems",
    description:
      "An app stopped, the disk is almost full, a client is stuck or missing, missed attestations and similar."
  },
  {
    key: "updates",
    title: "Important update warnings",
    description: "A version you run has a known problem, or a network upgrade deadline is close."
  },
  {
    key: "monthly",
    title: "Monthly health report",
    description: "A short summary of how your AVADO did, on the 1st of every month."
  }
];

export function timeAgo(value, now = Date.now()) {
  const date = value ? new Date(value) : null;
  if (!date || isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

function Toggle({ checked, onChange, disabled, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        <span className="text-xs text-fg-muted">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 ${
          checked ? "border-accent bg-accent" : "border-border bg-bg-subtle"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform duration-150 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function NeedsUpdateNotice({ message }) {
  return (
    <Notice variant="warning">
      {message}{" "}
      <Link to="/system" className="font-medium text-accent hover:underline">
        Open System
      </Link>
    </Notice>
  );
}

/* ---------------- Turn on alerts / watching ---------------- */

export function WatchingPanel({ careInstalled, careRunning, installHash, storeStatus, lastHeartbeatAt }) {
  const [status, setStatus] = useState(null);
  const [unreachable, setUnreachable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!careInstalled) return undefined;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      getCareStatus()
        .then(s => {
          if (cancelled) return;
          setStatus(s);
          setUnreachable(false);
        })
        .catch(() => !cancelled && setUnreachable(true))
        .finally(() => !cancelled && setLoading(false));
    };
    load();
    const t = setInterval(load, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [careInstalled]);

  if (!careInstalled) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-fg">Turn on alerts</h3>
          {!installHash && storeStatus !== "loading" && <Badge variant="neutral">Coming soon</Badge>}
        </div>
        {installHash ? (
          <>
            <p className="text-sm text-fg-muted">
              Alerts need the small AVADO Care app on your box. It checks your AVADO every 10
              minutes and tells us when something needs your attention. It never sends keys,
              wallet data or IP addresses.
            </p>
            <div>
              <Button as={Link} to={`/installer/${encodeURIComponent(installHash)}`}>
                Turn on alerts
              </Button>
            </div>
          </>
        ) : storeStatus === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Spinner size="sm" />
            Checking the AVADO store…
          </p>
        ) : (
          <p className="text-sm text-fg-muted">
            Alerts from your box are almost ready. As soon as the AVADO Care app is in the store,
            you can turn them on here with one click. Your other Priority Care benefits already
            work.
          </p>
        )}
      </div>
    );
  }

  const heartbeat = status && status.lastHeartbeat;
  const stale =
    heartbeat && heartbeat.at && Date.now() - new Date(heartbeat.at).getTime() > STALE_HEARTBEAT_MS;

  let badge;
  let body;
  if (!status && (loading || (!unreachable && careRunning !== false))) {
    badge = null;
    body = (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner size="sm" />
        Checking…
      </p>
    );
  } else if (unreachable || careRunning === false) {
    badge = <Badge variant="warning">Not answering</Badge>;
    body = (
      <>
        <p className="text-sm text-fg-muted">
          The AVADO Care app on your box is not answering right now. It may still be starting.
          If this does not go away in a few minutes, restart it from{" "}
          <Link
            to={`/packages/${CARE_PACKAGE}`}
            className="font-medium text-accent hover:underline"
          >
            its app page
          </Link>
          .
        </p>
        {lastHeartbeatAt && (
          <p className="text-xs text-fg-subtle">
            AVADO last heard from your box {timeAgo(lastHeartbeatAt)}.
          </p>
        )}
      </>
    );
  } else if (!heartbeat) {
    badge = <Badge variant="neutral">Starting</Badge>;
    body = (
      <p className="text-sm text-fg-muted">
        Your box is getting ready for its first check. This takes up to 10 minutes.
      </p>
    );
  } else if (!heartbeat.ok) {
    badge = <Badge variant="warning">Can&apos;t reach AVADO</Badge>;
    body = (
      <>
        <p className="text-sm text-fg-muted">
          Your box tried to check in {timeAgo(heartbeat.at)} but could not reach AVADO. Check
          that your AVADO is connected to the internet. It will keep trying every 10 minutes.
        </p>
        {heartbeat.error && <p className="text-xs text-fg-subtle">Details: {heartbeat.error}</p>}
      </>
    );
  } else if (stale) {
    badge = <Badge variant="warning">No recent check-in</Badge>;
    body = (
      <p className="text-sm text-fg-muted">
        Your box last checked in {timeAgo(heartbeat.at)}. It normally does every 10 minutes.
      </p>
    );
  } else {
    badge = (
      <Badge variant="success" dot>
        Watching
      </Badge>
    );
    body = (
      <>
        <p className="text-sm text-fg-muted">
          Your box checks itself every 10 minutes and reports to AVADO. Last check-in:{" "}
          {timeAgo(heartbeat.at)}.
        </p>
        {status.subscribed === false && (
          <p className="text-xs text-fg-subtle">
            AVADO does not see this box as a subscriber yet. If you just subscribed, this fixes
            itself within 10 minutes.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">AVADO is watching your box</h3>
        {badge}
      </div>
      {body}
    </div>
  );
}

/* ---------------- email + categories ---------------- */

export function AlertSettings({ nodeId, onSettings }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const apply = useCallback(
    s => {
      if (!mounted.current) return;
      setSettings(s);
      if (onSettings) onSettings(s);
    },
    [onSettings]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      apply(await getCareSettings(nodeId));
    } catch (e) {
      if (mounted.current) setLoadError(e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [nodeId, apply]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (what, changes) => {
    setBusy(what);
    setError(null);
    try {
      apply(await setCareSettings(nodeId, changes));
      return true;
    } catch (e) {
      if (mounted.current) setError(e);
      return false;
    } finally {
      if (mounted.current) setBusy("");
    }
  };

  const saveEmail = async e => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_REGEX.test(value)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    if (await run("email", { email: value })) setEditing(false);
  };

  const recheck = async () => {
    setBusy("recheck");
    setError(null);
    try {
      apply(await getCareSettings(nodeId));
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      if (mounted.current) setBusy("");
    }
  };

  const togglePref = (key, value) => {
    const prefs = { ...(settings.prefs || {}), [key]: value };
    // Show the change right away, the saved settings come back from the server
    setSettings(s => ({ ...s, prefs }));
    run(`pref-${key}`, { prefs }).then(ok => {
      if (!ok && mounted.current) setSettings(s => ({ ...s, prefs: { ...prefs, [key]: !value } }));
    });
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner size="sm" />
        Loading your alert settings…
      </p>
    );
  }

  if (loadError) {
    return loadError.code === "needs_update" ? (
      <NeedsUpdateNotice message={loadError.message} />
    ) : (
      <div className="flex flex-col gap-3">
        <Notice variant="danger">{loadError.message}</Notice>
        <div>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const prefs = (settings && settings.prefs) || {};
  const showForm = editing || !settings.email;

  return (
    <div className="flex flex-col gap-5">
      {error &&
        (error.code === "needs_update" ? (
          <NeedsUpdateNotice message={error.message} />
        ) : (
          <Notice variant="danger">{error.message}</Notice>
        ))}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-fg">Where should we send alerts?</h3>
          {settings.email && !editing && (
            <Badge variant={settings.verified ? "success" : "warning"}>
              {settings.verified ? "Confirmed" : "Not confirmed yet"}
            </Badge>
          )}
        </div>

        {showForm ? (
          <form onSubmit={saveEmail} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
            <Input
              type="email"
              label="Your email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={emailError}
              hint="We send a short email to confirm it is yours."
              className="flex-1"
              autoComplete="email"
            />
            <div className="flex gap-2 sm:mt-7">
              <Button type="submit" loading={busy === "email"} disabled={Boolean(busy)}>
                Save
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setEmailError("");
                  }}
                  disabled={Boolean(busy)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : settings.verified ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg-muted">
              Alerts go to <span className="font-medium text-fg">{settings.email}</span>.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEmail(settings.email);
                setEditing(true);
              }}
              disabled={Boolean(busy)}
            >
              Change email
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-muted">
              We sent an email to <span className="font-medium text-fg">{settings.email}</span>.
              Open it and click the link to confirm. Alerts start once it is confirmed.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={recheck}
                loading={busy === "recheck"}
                disabled={Boolean(busy)}
              >
                I&apos;ve confirmed it
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(settings.email);
                  setEditing(true);
                }}
                disabled={Boolean(busy)}
              >
                Use a different email
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-fg">What should we email you about?</h3>
        <div className="divide-y divide-border">
          {CATEGORIES.filter(c => PREF_KEYS.includes(c.key)).map(c => (
            <Toggle
              key={c.key}
              label={c.title}
              description={c.description}
              checked={Boolean(prefs[c.key])}
              disabled={Boolean(busy)}
              onChange={value => togglePref(c.key, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CareSection({ nodeId }) {
  const { packages = [], storePackages, sources = {} } = useHealth();
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null);
  const onSettings = useCallback(s => setLastHeartbeatAt((s && s.lastHeartbeatAt) || null), []);

  const carePkg = packages.find(p => p && p.name === CARE_PACKAGE);
  const installHash = carePkg ? null : storeHashFor(CARE_PACKAGE, storePackages);

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <CardTitle className="text-lg">Priority Care alerts</CardTitle>
        <CardDescription>
          We keep an eye on your AVADO and email you when something needs your attention.
        </CardDescription>
      </div>
      <WatchingPanel
        careInstalled={Boolean(carePkg)}
        careRunning={carePkg ? carePkg.running : undefined}
        installHash={installHash}
        storeStatus={sources.updates}
        lastHeartbeatAt={lastHeartbeatAt}
      />
      <div className="border-t border-border pt-5">
        <AlertSettings nodeId={nodeId} onSettings={onSettings} />
      </div>
    </Card>
  );
}
