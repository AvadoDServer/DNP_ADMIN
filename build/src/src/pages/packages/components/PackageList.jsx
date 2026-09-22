import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { createStructuredSelector } from "reselect";
import * as s from "../selectors";
import * as a from "../actions";
import { connect } from "react-redux";
import { NavLink } from "react-router-dom";
// Components
import NoPackagesYet from "./NoPackagesYet";
import StateBadge from "./PackageViews/StateBadge";
import { LoadingState, EmptyState } from "./PackagePresentation";
// UI kit
import Card from "components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "components/ui/Table";
import { cn } from "components/ui/cn";
import Switch from "components/Switch";
import axios from "axios";
// Selectors
import {
    getIsLoading,
    getLoadingError
} from "services/loadingStatus/selectors";
// Utils
import confirmRestartPackage from "./confirmRestartPackage";
// Icons
import { MdRefresh, MdOpenInNew, MdTune } from "react-icons/md";

const xnor = (a, b) => Boolean(a) === Boolean(b);

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

    const [storeManifest, setStoreManifest] = useState();
    const [buttonState, setButtonState] = useState({});

    useEffect(() => {
        axios
            .get(
                `https://bo.ava.do/value/store`
            )
            .then(res => {
                const storeRes = JSON.parse(res.data);
                const storeHash = storeRes.hash;
                axios
                    .get(
                        `http://ipfs.my.ava.do:8080/ipfs/${storeHash}`
                    )
                    .then(res => {
                        const storeManifest = res.data;
                        setStoreManifest(res.data);
                    })
                    .catch(error => {
                        //debugger;
                    });
            }).catch(error => {
                //debugger;
            });

    }, []);


    // we wrap these changes in a local state - so the button presses are instantanious
    const setAutoUpdateWrapper = (name, autoupdate) => {
        const state = Object.assign({}, buttonState);
        state[name] = autoupdate;
        setButtonState(state);
        setAutoUpdate(name, autoupdate);
    }

    // if a local cached state exists - use that.
    // when a package reload is done - this will be overwritten
    const getAutoUpdateState = (dnp) => {
        if (!dnp) return false;
        return buttonState[dnp.name] === undefined ? dnp.autoupdate : buttonState[dnp.name]
    }

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

    //   const filteredDnps = dnps; //.filter(dnp => xnor(coreDnps, dnp.isCore));
    const filteredDnps = dnps.filter(dnp => xnor(coreDnps, dnp.isCore)).map((p) => {
        p.title = p.manifest && p.manifest.title ? p.manifest.title : p.name;
        if (!storeManifest) return p;
        const manifestPackage = storeManifest.packages.find((mp) => {
            return mp.manifest.name === p.name
        })
        if (manifestPackage) p.title = manifestPackage.manifest.title || p.name;
        return p;
    }).sort((a, b) => a.title.localeCompare(b.title));

    if (!filteredDnps.length) return <NoPackagesYet />;

    const iconBtn =
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-accent focus:outline-none focus-visible:shadow-focus";

    return (
        <Card padding="none" className="overflow-hidden">
            <Table>
                <THead>
                    <TR className="border-b border-border">
                        <TH>Status</TH>
                        <TH>Name</TH>
                        {showOpen && <TH align="center">Open</TH>}
                        <TH align="center">Manage</TH>
                        {showRestart && <TH align="center">Restart</TH>}
                        <TH align="center">Auto-update</TH>
                    </TR>
                </THead>
                <TBody>
                    {filteredDnps.map(({ version, id, name, title, state, manifest }) => {
                        const external =
                            manifest && manifest.ui && manifest.ui.OnboardingWizard && manifest.ui.OnboardingWizard.external;
                        const openUrl = external ? manifest.ui.OnboardingWizard.url : null;
                        const label = `${title || name} (${version})`;
                        return (
                            <TR key={name}>
                                <TD>
                                    <StateBadge state={state} />
                                </TD>
                                <TD>
                                    {external ? (
                                        <a
                                            href={openUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium capitalize text-fg transition-colors hover:text-accent"
                                            title={label}
                                        >
                                            {label}
                                        </a>
                                    ) : (
                                        <NavLink
                                            to={`/${moduleName}/${name}`}
                                            className="font-medium capitalize text-fg transition-colors hover:text-accent"
                                            title={label}
                                        >
                                            {label}
                                        </NavLink>
                                    )}
                                </TD>
                                {showOpen && (
                                    <TD align="center">
                                        {external ? (
                                            <a href={openUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label={`Open ${title || name}`}>
                                                <MdOpenInNew />
                                            </a>
                                        ) : (
                                            <NavLink to={`/${moduleName}/${name}`} className={iconBtn} aria-label={`Open ${title || name}`}>
                                                <MdOpenInNew />
                                            </NavLink>
                                        )}
                                    </TD>
                                )}
                                <TD align="center">
                                    <NavLink to={`/${moduleName}/${name}/detail`} className={iconBtn} aria-label={`Manage ${title || name}`}>
                                        <MdTune />
                                    </NavLink>
                                </TD>
                                {showRestart && (
                                    <TD align="center">
                                        <button
                                            type="button"
                                            className={cn(iconBtn, "hover:text-warning")}
                                            aria-label={`Restart ${title || name}`}
                                            onClick={() => confirmRestartPackage(name, restartPackage)}
                                        >
                                            <MdRefresh />
                                        </button>
                                    </TD>
                                )}
                                <TD align="center">
                                    <div className="inline-flex">
                                        <Switch
                                            checked={getAutoUpdateState(manifest)}
                                            onToggle={() => {
                                                setAutoUpdateWrapper(name, !getAutoUpdateState(manifest));
                                            }}
                                        />
                                    </div>
                                </TD>
                            </TR>
                        );
                    })}
                </TBody>
            </Table>
        </Card>
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
