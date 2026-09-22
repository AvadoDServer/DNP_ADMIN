import React from "react";
import { connect } from "react-redux";
import * as s from "../selectors";
import { createStructuredSelector } from "reselect";
import PropTypes from "prop-types";
// Components
import Wizard from "./PackageViews/Details/Wizard";
import "./PackageViews/Details/Wizard.css";
import Details from "./PackageViews/Details";
import Logs from "./PackageViews/Logs";
import Envs from "./PackageViews/Envs";
import FileManager from "./PackageViews/FileManager";
import Controls from "./PackageViews/Controls";
import NoDnpInstalled from "./NoDnpInstalled";
// Components
import { PageHeader, LoadingState, EmptyState } from "./PackagePresentation";
// Selectors
import {
    getIsLoading,
    getLoadingError
} from "services/loadingStatus/selectors";

const filler = () => {
    let r = "";
    for (let c = 0; c < 1000; c++) {
        r += ` ${c}`;
    }
    return (<>{r}</>);
}

const PackageInterface = ({
    dnp,
    id,
    moduleName,
    areThereDnps,
    loading,
    error
}) => {

    return (
        <>
            {dnp ? (
                <>
                    {dnp.manifest && dnp.manifest.links && dnp.manifest.links.OnboardingWizard ? (
                        <>
                            <div>
                                <Wizard dnp={dnp} />
                            </div>
                        </>
                    ) :
                        (dnp.name === "remoteconnect.avado.dnp.dappnode.eth" ? (
                            <>
                                <div>
                                    <Wizard dnp={{ manifest: { links: { OnboardingWizard: "http://remoteconnect.my.ava.do" } } }} />
                                </div>
                            </>

                        ) :

                            (
                                <div className="animate-fade-in flex flex-col gap-2">
                                    <PageHeader title={dnp.manifest && dnp.manifest.title ? dnp.manifest.title : id}>
                                        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                                            DApp
                                        </span>
                                    </PageHeader>
                                    <Details dnp={dnp} />
                                    <Controls dnp={dnp} />
                                    <Envs dnp={dnp} />
                                    <FileManager dnp={dnp} />
                                    <Logs id={dnp.name} />
                                </div>
                            )
                        )
                    }
                </>
            ) : loading ? (
                <LoadingState label="Loading installed package…" />
            ) : error ? (
                <EmptyState
                    tone="danger"
                    icon={
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" />
                        </svg>
                    }
                    title="Could not load package"
                >
                    {String(error)}
                </EmptyState>
            ) : areThereDnps ? (
                <NoDnpInstalled id={id} moduleName={moduleName} />
            ) : null}
        </>
    )
};

PackageInterface.propTypes = {
    dnp: PropTypes.object,
    id: PropTypes.string,
    moduleName: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string.isRequired
};

// Container

const mapStateToProps = createStructuredSelector({
    dnp: s.getDnp,
    // id and moduleName are parsed from the url at the selector (with the router state)
    id: s.getUrlId,
    moduleName: s.getModuleName,
    areThereDnps: s.areThereDnps,
    loadingDnps: getIsLoading.dnpInstalled,
    loading: getIsLoading.dnpInstalled,
    error: getLoadingError.dnpInstalled
});

const mapDispatchToProps = null;

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PackageInterface);
