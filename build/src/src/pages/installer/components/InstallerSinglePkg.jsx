import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import withTitle from "components/hoc/withTitle";
import { compose } from "redux";
import { createStructuredSelector } from "reselect";
import PropTypes from "prop-types";
import { toSentence } from "utils/strings";
import { isEmpty } from "lodash";
// This module
import * as s from "../selectors";
import * as a from "../actions";
import ProgressLogs from "./InstallCardComponents/ProgressLogs";
// Selectors
import { getProgressLogsByDnp } from "services/isInstallingLogs/selectors";
import { rootPath as packagesRootPath } from "pages/packages/data";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Spinner from "components/ui/Spinner";
import Switch from "components/Switch";
import { StoreEmpty } from "./StorePresentation";
import defaultAvatar from "img/defaultAvatar.png";
import humanFileSize from "utils/humanFileSize";
import { PageHeader } from "components/ui/PageHeader";
import ReactMarkdown from 'react-markdown'

function InstallerInterface({
    id,
    dnp,
    progressLogs,
    // Actions
    install,
    clearUserSet,
    fetchPackageRequest,
    // Extra
    packages,
    history
}) {
    const [showSettings, setShowSettings] = useState(false);
    const [options, setOptions] = useState({});
    const [installedPackage, setInstalledPackage] = useState();
    const [showedPackage, setShowedPackage] = useState();

    useEffect(() => {
        clearUserSet();
        fetchPackageRequest(id);
    }, [id]);

    const { loading, resolving, error, manifest, requestResult, tag } = dnp || {};
    const { name, type } = manifest || {};

    useEffect(() => {
        if (packages && manifest) {
            const installedPackage = packages.find((installedpackage) => {
                // console.log(`check package ${installedpackage.name}`);
                return installedpackage.name === manifest.name
            });
            setInstalledPackage(installedPackage);
        }
    }, [packages, manifest]);

    useEffect(() => {
        if (dnp && dnp.manifest) {
            // // console.log(dnp);
            // axios
            //     .get(
            //         `https://bo.ava.do/value/package-override-${dnp.manifest.name}`
            //     )
            //     .then(res => {
            //         const storeRes = JSON.parse(res.data);
            //         const patchedPackage = {
            //             ...installedPackage,
            //             ...storeRes
            //         };
            //         setShowedPackage(patchedPackage);
            //     }).catch((e) => {
                    setShowedPackage(dnp.manifest);
                // });
        }
    }, [dnp]);


    //   // When the DNP is updated (finish installation), redirect to /packages
    //   useEffect(() => {
    //     if (stringIncludes(tag, "updated") && name)
    //       history.push(packagesRootPath + "/" + name);
    //   }, [tag]);


    const toWizard = () => {
        history.push(`${packagesRootPath}/${name}`);
    }

    const manage = (name) => {
        // debugger;
        history.push(`${packagesRootPath}/${name}/detail`);
    }

    // then it's a custom hash on the root
    if (id.startsWith("custom")) {
        return null;
    }

    if (error && !manifest)
        return (
            <StoreEmpty
                icon={
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                }
                title="Could not load package"
            >
                {String(error)}
            </StoreEmpty>
        );
    if (loading)
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-fg-muted">
                <Spinner size="lg" className="text-accent" />
                <span className="text-sm">Loading package…</span>
            </div>
        );
    if (!dnp && !error)
        return (
            <StoreEmpty
                icon={
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                }
                title="Package not found"
            />
        );

    let actionButtonTxt;
    if (!installedPackage) {
        actionButtonTxt = "Install"
    }

    if (installedPackage && manifest && installedPackage.version !== manifest.version) {
        actionButtonTxt = `Update to ${manifest.version}`
    }
    const hasWizard = manifest && manifest.links && manifest.links.OnboardingWizard;


    /**
     * Filter options according to the current package
     * 1. If package is core and from ipfs, show "BYPASS_CORE_RESTRICTION" option
     */
    const availableOptions = [];
    if ((id || "").startsWith("/ipfs/") && type === "dncore")
        availableOptions.push("BYPASS_CORE_RESTRICTION");
    // debugger;
    // Otherwise, show info an allow an install
    if (!showedPackage) {
        return (<>&nbsp;</>);
    }

    let dnpData = {
        "Latest version": dnp.manifest.version,
        "Size": dnp && humanFileSize(dnp.manifest.image.size),
    };
    if (dnp && dnp.manifest.upstream) {
        dnpData["Based on"] = `${dnp.manifest.upstream}`
    }

    if (dnp && dnp.manifest.builddate) {
        const date = new Date(dnp.manifest.builddate);
        dnpData["Released on"] = `${date.toLocaleDateString()}`
    }

    return (
        <div className="animate-fade-in">
            <PageHeader eyebrow="DappStore" title={dnp.manifest.title} />

            <ProgressLogs progressLogs={progressLogs} />

            <Card padding="lg" className="flex flex-col gap-6 md:flex-row md:items-start">
                <img
                    src={dnp.avatar || defaultAvatar}
                    alt=""
                    onError={(e) => {
                        e.currentTarget.src = defaultAvatar;
                    }}
                    className="h-28 w-28 flex-shrink-0 rounded-xl border border-border object-cover"
                />

                <div className="min-w-0 flex-1">
                    {showedPackage.descriptionmd ? (
                        <div className="prose-installer max-w-none text-sm leading-relaxed text-fg-muted [&_a]:text-accent [&_a:hover]:underline [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-fg [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
                            <ReactMarkdown>{showedPackage.descriptionmd}</ReactMarkdown>
                        </div>
                    ) : (
                        <>
                            <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
                                {dnp.manifest.description}
                            </p>
                        </>
                    )}

                    {/* Metadata */}
                    {/* Facts: label and value side by side, not spread across the card */}
                    <dl className="mt-5 grid max-w-xl grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 border-t border-border pt-4 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
                        {Object.entries(dnpData).map(([key, val]) => (
                            <React.Fragment key={key}>
                                <dt className="text-fg-subtle">{key}</dt>
                                <dd className="mb-0 truncate font-medium text-fg" title={String(val)}>
                                    {val}
                                </dd>
                            </React.Fragment>
                        ))}
                    </dl>

                    {/* Options (e.g. BYPASS_CORE_RESTRICTION) */}
                    {availableOptions.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                            {availableOptions.map((option) => (
                                <Switch
                                    key={option}
                                    checked={options[option]}
                                    onToggle={(value) => setOptions({ [option]: value })}
                                    label={toSentence(option)}
                                    id={"switch-" + option}
                                />
                            ))}
                        </div>
                    )}

                    {installedPackage && (
                        <p className="mt-4 text-sm text-fg-muted">
                            Installed version{" "}
                            <span className="font-medium text-fg">
                                {installedPackage.version}
                            </span>
                        </p>
                    )}

                    {/* Actions */}
                    <div className="mt-5 flex flex-wrap gap-3">
                        {actionButtonTxt && isEmpty(progressLogs) && (
                            <Button variant="primary" onClick={() => install(id, options)}>
                                {actionButtonTxt}
                            </Button>
                        )}
                        {installedPackage && (
                            <>
                                {hasWizard && (
                                    <Button variant="secondary" onClick={() => toWizard(name)}>
                                        Configure package
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={() => manage(name)}>
                                    Manage package
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

InstallerInterface.propTypes = {
    id: PropTypes.string.isRequired,
    dnp: PropTypes.object,
    history: PropTypes.object.isRequired,
    packages: PropTypes.array.isRequired,
};

// Container

const mapStateToProps = createStructuredSelector({
    id: s.getQueryId,
    dnp: s.getQueryDnp,
    progressLogs: (state, ownProps) =>
        getProgressLogsByDnp(state, s.getQueryIdOrName(state, ownProps)),
    // For the withTitle HOC
    // subtitle: s.getQueryIdOrName,
    packages: s.getInstalled
});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = {
    install: a.install,
    clearUserSet: a.clearUserSet,
    fetchPackageRequest: a.fetchPackageRequest
};

export default compose(
    withRouter,
    connect(
        mapStateToProps,
        mapDispatchToProps
    ),
    // withTitle("Installer")
)(InstallerInterface);

// ##### TODO: - Implement the loading HOC for the specific DNP fetch
