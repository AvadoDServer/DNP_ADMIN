import { useId, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useHistory } from "react-router-dom";
import { getDnpInstalled } from "services/dnpInstalled/selectors";
import { getDappmanagerVersionData } from "services/dappnodeStatus/selectors";
import { canChangeBoxPassword, boxPasswordNeedsUpdate } from "health/clients";
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { PageHeader } from "components/ui/PageHeader";
import { cn } from "components/ui/cn";
import {
  changeBoxPassword,
  newPasswordProblem,
  useIsDefaultPassword,
  isNoticeDismissed,
  dismissNotice,
  MIN_LENGTH,
  PAGE_PATH,
  SUCCESS_TEXT,
  NOT_SAME_TEXT,
  OLD_CORE_TEXT,
} from "../boxPasswordApi";

/**
 * "Change box password": the password of the `avado` user, which logs in to
 * the AVADO with SSH. Three fields (current, new, new again), each with a
 * Show switch, and one button. Shown on System > Overview and on its own page
 * (/system/password), which Simple mode reaches from Home's notice and Help.
 */

/** Whether this core can change the password, read from the package list */
export function useBoxPasswordGate() {
  const packages = useSelector(getDnpInstalled) || [];
  const versionData = useSelector(getDappmanagerVersionData);
  const own = versionData && versionData.version;
  return { allowed: canChangeBoxPassword(packages, own), needsUpdate: boxPasswordNeedsUpdate(packages, own) };
}

function PasswordField({ label, hint, error, value, onChange, autoComplete, name, disabled }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-control border bg-surface pl-3.5 pr-20 text-base text-fg transition-colors duration-150 placeholder:text-fg-subtle focus:outline-none focus-visible:border-accent focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm",
            error ? "border-danger" : "border-border"
          )}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-pressed={shown}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-1 right-1 rounded-control px-3 text-sm font-semibold text-accent hover:bg-accent/10 focus:outline-none focus-visible:shadow-focus"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs text-danger-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function BoxPasswordForm({ changeImpl, onChanged }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  // Field errors show after the first press of the button, not while typing
  const [tried, setTried] = useState(false);

  const nextProblem = next ? newPasswordProblem(next, current) : tried ? "Type a new password." : null;
  const againProblem = again && again !== next ? NOT_SAME_TEXT : tried && !again ? "Type the new password again." : null;
  const currentProblem = tried && !current ? "Type your current password." : null;

  const edit = setter => value => {
    setter(value);
    setError(null);
    setDone(false);
  };

  const onSubmit = async e => {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    setDone(false);
    setError(null);
    if (!current || newPasswordProblem(next, current) || !again || again !== next) return;
    setBusy(true);
    try {
      await changeBoxPassword({ currentPassword: current, newPassword: next }, changeImpl);
      setCurrent("");
      setNext("");
      setAgain("");
      setTried(false);
      setDone(true);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
      {/* Lets password managers file the new password under the right user */}
      <input type="text" name="username" autoComplete="username" value="avado" readOnly hidden />
      <PasswordField
        label="Current password"
        name="current-password"
        autoComplete="current-password"
        value={current}
        onChange={edit(setCurrent)}
        error={currentProblem}
        disabled={busy}
      />
      <PasswordField
        label="New password"
        name="new-password"
        autoComplete="new-password"
        hint={`At least ${MIN_LENGTH} characters.`}
        value={next}
        onChange={edit(setNext)}
        error={nextProblem}
        disabled={busy}
      />
      <PasswordField
        label="New password again"
        name="new-password-again"
        autoComplete="new-password"
        value={again}
        onChange={edit(setAgain)}
        error={againProblem}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="mb-0 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger-text">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mb-0 rounded-md bg-success-subtle px-3 py-2 text-sm font-medium text-success-text">
          {SUCCESS_TEXT}
        </p>
      )}
      <Button type="submit" loading={busy} className="w-full sm:w-auto sm:self-start">
        {busy ? "Changing…" : "Change password"}
      </Button>
      <p className="mb-0 text-xs text-fg-subtle">Write the new password down. AVADO support cannot see it or get it back for you.</p>
    </form>
  );
}

export function BoxPasswordCard({ changeImpl, checkImpl }) {
  const { allowed, needsUpdate } = useBoxPasswordGate();
  const isDefault = useIsDefaultPassword(allowed, checkImpl);
  return (
    <Card as="section" aria-labelledby="box-password-title" padding="lg" className="flex flex-col gap-5">
      <div>
        <h2 id="box-password-title" className="mb-1 font-display text-lg font-semibold text-fg">
          Change box password
        </h2>
        <p className="mb-0 text-sm text-fg-muted">
          This is the password for logging in to your AVADO with SSH (user <span className="font-mono">avado</span>). Every AVADO starts with
          the password <span className="font-mono">avado</span>.
        </p>
      </div>
      {isDefault === true && (
        <p className="mb-0 rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-text">
          Your AVADO still uses the factory password. Choose your own.
        </p>
      )}
      {needsUpdate ? (
        <p className="mb-0 text-sm text-fg">
          {OLD_CORE_TEXT}{" "}
          <Link to="/system/updates" className="font-semibold text-accent hover:underline">
            Open Updates
          </Link>
        </p>
      ) : (
        <BoxPasswordForm changeImpl={changeImpl} />
      )}
    </Card>
  );
}

/** /system/password: the card on its own page, for Simple mode too */
export function BoxPasswordPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Box password" subtitle="Keep other people out of your AVADO." />
      <BoxPasswordCard />
    </div>
  );
}

/**
 * Home: a short notice while the box still has the factory password, until
 * the owner changes it or closes the notice ("Not now", remembered in this
 * browser).
 */
export function DefaultPasswordNotice({ checkImpl }) {
  const history = useHistory();
  const { allowed } = useBoxPasswordGate();
  const isDefault = useIsDefaultPassword(allowed, checkImpl);
  const [dismissed, setDismissed] = useState(isNoticeDismissed);
  if (isDefault !== true || dismissed) return null;
  return (
    <Card
      as="section"
      aria-labelledby="password-notice-title"
      padding="md"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <h2 id="password-notice-title" className="mb-1 font-display text-base font-semibold text-fg">
          Change your AVADO's password
        </h2>
        <p className="mb-0 text-sm text-fg-muted">
          It is still the factory password <span className="font-mono">avado</span>, which anyone can look up.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => history.push(PAGE_PATH)}>
          Change password
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            dismissNotice();
            setDismissed(true);
          }}
        >
          Not now
        </Button>
      </div>
    </Card>
  );
}

export default BoxPasswordCard;
