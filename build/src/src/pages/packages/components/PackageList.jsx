import React, { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { createStructuredSelector } from "reselect";
import PropTypes from "prop-types";
import * as s from "../selectors";
import * as a from "../actions";
// Components
import NoPackagesYet from "./NoPackagesYet";
import { LoadingState, EmptyState } from "./PackagePresentation";
// UI kit
import AppAvatar from "components/ui/AppAvatar";
import StatusPill from "components/ui/StatusPill";
import Switch from "components/Switch";
import { openUrl } from "components/apps/AppCard";
// Health / status helpers
import { useHealth } from "health/HealthProvider";
import { appStatus, appDescription } from "components/appStatus";
import { appTitle } from "health/rules/apps";
// Selectors
import {
    getIsLoading,
    getLoadingError
} from "services/loadingStatus/selectors";
// Utils
import confirmRestartPackage from "./confirmRestartPackage";
// Icons
import { MdRefresh } from "react-icons/md";

const xnor = (a, b) => Boolean(a) === Boolean(b);

// Reads the package's own autoupdate flag (not the manifest's). Packages
// without the flag default to on, matching the rest of the app (e.g. the
// autoupdateOff health rule only treats an explicit `false` as "off").
export const getAutoUpdateState = dnp => Boolean(dnp) && dnp.autoupdate !== false;

const iconBtn =
    "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-warning-text focus:outline-none focus-visible:shadow-focus";

const linkCls = "text-sm font-medium text-accent transition-colors hover:underline";

const AUTOUPDATE_PENDING_TIMEOUT = 10000;

/**
 * The auto-update switch gives immediate feedback: on click it shows the
 * requested value right away and disables itself, since the real change only
 * lands once the backend pushes the updated package back over WAMP (there is
 * no optimistic redux update). It waits for redux to agree with the
 * requested value, or reverts to whatever redux says after 10s.
 */
export function AutoUpdateSwitch({ dnp, title, setAutoUpdate }) {
    const actual = getAutoUpdateState(dnp);
    const [pending, setPending] = useState(null); // null | boolean (the requested value)
    const timeoutRef = useRef(null);

    // Redux caught up with the requested value (or moved on its own) — clear the pending state.
    useEffect(() => {
        if (pending !== null && actual === pending) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setPending(null);
        }
    }, [actual, pending]);

    // Clear any in-flight timeout on unmount.
    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const checked = pending !== null ? pending : actual;

    const onToggle = () => {
        const next = !actual;
        setPending(next);
        setAutoUpdate(dnp.name, next);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setPending(null), AUTOUPDATE_PENDING_TIMEOUT);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="hidden text-xs text-fg-muted sm:inline" aria-hidden="true">
                Auto-update
            </span>
            <Switch
                id={`autoupdate-${dnp.name}`}
                checked={checked}
                disabled={pending !== null}
                onToggle={onToggle}
                aria-label={`Auto-update for ${title}`}
            />
        </div>
    );
}

const PackagesList = ({
    dnps = [],
    moduleName,
    coreDnps,
    loading,
    error,
    restartPackage,
    setAutoUpdate,
    showRestart = true,
    showOpen = true,
}) => {
    const { findings, updates } = useHealth();

    if (loading) return <LoadingState label="Loading installed DApps…" />;
    if (error)
        return (
            <EmptyState
                tone="danger"
                icon={
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                }
                title="Could not load your DApps"
            >
                {String(error)}
            </EmptyState>
        );

    // The link base must be lower-case: moduleName ("Packages" / "System")
    // is a display label, but the routes are /packages and /system.
    const base = `/${(moduleName || "").toLowerCase()}`;

    const filteredDnps = dnps
        .filter(dnp => xnor(coreDnps, dnp.isCore))
        .sort((x, y) => appTitle(x).localeCompare(appTitle(y)));

    if (!filteredDnps.length) return <NoPackagesYet />;

    // My DApps = a list of "bays" (the same visual language as the Home app
    // bays — see components/apps/AppCard.jsx — laid out as full-width rows
    // instead of a grid, so every control has room next to it).
    return (
        <section>
            <ul className="flex flex-col gap-3">
                {filteredDnps.map(dnp => {
                    const { name } = dnp;
                    const title = appTitle(dnp);
                    const description = appDescription(dnp);
                    const status = appStatus(dnp, { findings, updates });
                    const external = showOpen ? openUrl(dnp) : null;

                    return (
                        <li
                            key={name}
                            className="flex flex-col gap-3 rounded-tile bg-surface p-4 shadow-[0_1px_0_rgb(var(--border))] dark:border dark:border-border dark:shadow-none sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
                        >
                            <div className="flex min-w-0 items-center gap-3.5">
                                <AppAvatar pkg={dnp} size={44} />
                                <div className="min-w-0">
                                    <div className="break-words font-display text-lg font-bold text-fg">{title}</div>
                                    {description && (
                                        <p className="mb-0 break-words text-sm text-fg-muted">{description}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 sm:flex-shrink-0">
                                <StatusPill status={status} />

                                {showOpen && (
                                    external ? (
                                        <a href={external} target="_blank" rel="noopener noreferrer" className={linkCls}>
                                            Open
                                        </a>
                                    ) : (
                                        <Link to={`${base}/${name}?tab=setup`} className={linkCls}>
                                            Open
                                        </Link>
                                    )
                                )}

                                <Link to={`${base}/${name}`} className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
                                    Manage
                                </Link>

                                {showRestart && (
                                    <button
                                        type="button"
                                        className={iconBtn}
                                        aria-label={`Restart ${title}`}
                                        onClick={() => confirmRestartPackage(name, restartPackage)}
                                    >
                                        <MdRefresh />
                                    </button>
                                )}

                                <AutoUpdateSwitch dnp={dnp} title={title} setAutoUpdate={setAutoUpdate} />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

PackagesList.propTypes = {
    dnps: PropTypes.array.isRequired,
    moduleName: PropTypes.string.isRequired,
    coreDnps: PropTypes.bool,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string.isRequired
};

// Container

const mapStateToProps = createStructuredSelector({
    dnps: s.getFilteredPackages,
    loading: getIsLoading.dnpInstalled,
    error: getLoadingError.dnpInstalled
});

const mapDispatchToProps = {
    restartPackage: a.restartPackage,
    setAutoUpdate: a.setAutoUpdate
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PackagesList);
