import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { compose } from "redux";
import { createStructuredSelector } from "reselect";
// This page
import * as a from "../actions";
import * as s from "../selectors";
import isIpfsHash from "utils/isIpfsHash";
import isDnpDomain from "utils/isDnpDomain";
import { correctPackageName } from "../utils";
import filterDirectory from "../helpers/filterDirectory";
import { rootPath } from "../data";
import NoPackageFound from "./NoPackageFound";
import TypeFilter from "./TypeFilter";
import ManifestStore from "./ManifestStore";
import PackageStore from "./PackageStore";
import {
    CategoryHeader,
    StoreSkeleton,
    StoreEmpty
} from "./StorePresentation";
// UI kit
import { Input } from "components/ui/Input";
import Button from "components/ui/Button";
// Selectors
import { getMainnet } from "services/chainData/selectors";
import {
    getIsLoading,
    getLoadingError
} from "services/loadingStatus/selectors";
import { rootPath as packagesRootPath } from "pages/packages/data";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
import IsSyncing from "./IsSyncing";
import { fetchStore } from "services/store/fetchStore";

function InstallerHome({
    // variables
    id,
    directory,
    mainnet,
    loading,
    error,
    history,
    // Actions
    fetchPackageData,
    fetchPackageDataFromQuery,
    packages,
    match,
    dappnodeParams
}) {
    const [query, setQuery] = useState("");
    const [selectedTypes, setSelectedTypes] = useState({});
    const [storeManifest, setStoreManifest] = useState();
    const [displayManifest, setDisplayManifest] = useState();

    useEffect(() => {
        if (packages && storeManifest && packages.length > 0) {
            storeManifest.packages = storeManifest.packages.map((p) => {
                // console.log(p);
                const installedPackage = packages.find((installedpackage) => {
                    // console.log(`check package ${installedpackage.name}`);
                    return installedpackage.name === p.manifest.name
                });
                if (installedPackage) {
                    p.installed = true;
                    p.installedVersion = installedPackage.version;
                    // debugger;
                }
                return p;
            });
            setDisplayManifest(storeManifest);
        }
    }, [packages, storeManifest]);


    useEffect(() => {
        if (!packages || !dappnodeParams || !dappnodeParams.nodeid) return;
        const storeHash = id && id !== "undefined" ? id : undefined;
        fetchStore({ nodeid: dappnodeParams.nodeid, packages, storeHash })
            .then(setStoreManifest)
            .catch(error => console.log(`Failed to fetch store: ${error.message}`));
    }, [packages, dappnodeParams]);

    useEffect(() => {
        // If the packageLink is a valid IPFS hash preload it's info
        if (isIpfsHash(query) || isDnpDomain(query))
            fetchPackageDataFromQuery(query);
    }, [query]);

    function openDnp(id) {
        // debugger;
        const dnp = directory.find(({ name }) => name === id);
        // debugger;
        if ((dnp || {}).tag === "UPDATED") {

            history.push(packagesRootPath + "/" + dnp.name);
        } else {
            fetchPackageData(id);
            history.push(rootPath + "/" + encodeURIComponent(id));
        }
    }

    function onTypeChange(type) {
        setSelectedTypes(ts => ({ ...ts, [type]: !ts[type] }));
    }

    const directoryFiltered = filterDirectory({
        directory,
        query,
        selectedTypes
    });

    /**
     * 1. If the query is a valid IPFS hash, open it
     * 2. If the query matches exactly one DNP, open it
     * 0. Else open the query
     */
    function runQuery() {
        if (isIpfsHash(query)) return openDnp(query);
        if (directoryFiltered.length === 1)
            return openDnp(directoryFiltered[0].name);
        else openDnp(query);
    }

    const types = {
        ...directory.reduce((obj, { manifest = {} }) => {
            if (manifest.type) obj[manifest.type] = false;
            return obj;
        }, {}),
        ...selectedTypes
    };

    /**
     * Isolate the switching logic:
     * 1. If there is a search and it's empty show "NoDnp"
     * 2. If it is still syncing, show "IsSyncing"
     * 3. If it is loading, show "Loading"
     * 0. Else show the DnpStore
     */
    function Body() {
        if (
            !displayManifest ||
            !displayManifest.packages ||
            !displayManifest.packages.length
        )
            return <StoreSkeleton />;

        const categories = displayManifest.categories.sort((a, b) => {
            return a.weight - b.weight;
        });

        // When the user is searching, flatten everything into a single
        // result grid filtered by the current query instead of per-category.
        if (query) {
            const matches = displayManifest.packages.filter((p) => {
                const { name = "", title = "", description = "" } =
                    p.manifest || {};
                const q = query.toLowerCase();
                return (
                    name.toLowerCase().includes(q) ||
                    title.toLowerCase().includes(q) ||
                    description.toLowerCase().includes(q)
                );
            });

            if (!matches.length)
                return (
                    <StoreEmpty
                        icon={
                            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        }
                        title={`No packages match “${query}”`}
                    >
                        Try a different name, or paste an IPFS hash to install a
                        custom package.
                    </StoreEmpty>
                );

            return (
                <>
                    <CategoryHeader title="Search results" count={matches.length} />
                    <ManifestStore directory={matches} openDnp={openDnp} />
                </>
            );
        }

        return categories.map((cat, i) => {
            const subdir = displayManifest.packages.filter((p) => {
                return p.manifest.avadocategory === cat.tag;
            });
            if (!subdir.length) return null;
            return (
                <div key={i}>
                    <CategoryHeader title={cat.description} count={subdir.length} />
                    <ManifestStore directory={subdir} openDnp={openDnp} />
                </div>
            );
        });
    }

    return (
        <div className="animate-fade-in">
            {/* Hero header */}
            <div className="mb-6 flex flex-col gap-1 border-b border-border pb-5">
                <h1 className="text-3xl font-bold tracking-tight text-fg">
                    DappStore
                </h1>
                <p className="text-sm text-fg-muted">
                    Browse and install AVADO packages, or paste an IPFS hash to add a
                    custom one.
                </p>
            </div>

            {/* Search */}
            <form
                className="mb-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    runQuery();
                }}
                role="search"
            >
                <div className="flex items-stretch gap-2">
                    <Input
                        className="flex-1"
                        aria-label="Search packages"
                        placeholder="Package name or IPFS hash"
                        value={query}
                        onChange={(e) =>
                            setQuery(correctPackageName(e.target.value))
                        }
                    />
                    <Button type="submit" variant="primary">
                        Search
                    </Button>
                </div>
            </form>

            <Body />
        </div>
    );
}

InstallerHome.propTypes = {
    // State -> props
    id: PropTypes.string,
    directory: PropTypes.array.isRequired,
    selectedTypes: PropTypes.object.isRequired,
    inputValue: PropTypes.string.isRequired,
    history: PropTypes.object.isRequired,
    mainnet: PropTypes.object.isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string.isRequired,
    // Dispatch -> props
    fetchPackageData: PropTypes.func.isRequired,
    fetchPackageDataFromQuery: PropTypes.func.isRequired,
    packages: PropTypes.array.isRequired,
    dappnodeParams: PropTypes.object.isRequired
};

const mapStateToProps = createStructuredSelector({
    id: s.getQueryId,
    directory: s.getDnpDirectoryWithTagsNonCores,
    directoryLoaded: s.directoryLoaded,
    selectedTypes: s.getSelectedTypes,
    inputValue: s.getInputValue,
    mainnet: getMainnet,
    loading: getIsLoading.dnpDirectory,
    error: getLoadingError.dnpDirectory,
    packages: s.getInstalled,
    dappnodeParams: getDappnodeParams
});

const mapDispatchToProps = {
    fetchPackageData: a.fetchPackageData,
    fetchPackageDataFromQuery: a.fetchPackageDataFromQuery
};

export default compose(
    withRouter,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(InstallerHome);
