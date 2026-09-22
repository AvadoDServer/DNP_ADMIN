import React from "react";
import PropTypes from "prop-types";
import { Link, useHistory } from "react-router-dom";
import semver from "semver";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import AppAvatar from "components/ui/AppAvatar";
import { appDescription } from "components/appStatus";
import { rootPath as packagesRootPath } from "pages/packages/data";

/**
 * DappStore category grid. Same redux/manifest data shape as before — only
 * presentation is modernized onto the design system.
 */
function ManifestStore({ directory, openDnp }) {
  const history = useHistory();
  const visible = directory.filter((item) => {
    if (!item || !item.manifest || !item.manifest.hidden === true) return true;
    return false;
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((p, i) => {
        const { title, name, version } = p.manifest || {};
        const description = appDescription(p);
        const installed = Boolean(p.installed);
        const hasUpdate =
          installed &&
          p.installedVersion &&
          version &&
          semver.valid(version) &&
          semver.valid(p.installedVersion) &&
          semver.gt(version, p.installedVersion);
        const pkg = { name, manifest: p.manifest };
        // Installed, up-to-date entries have nowhere to "install" or "update"
        // to — the card (and its button) should go straight to the app's
        // own page instead of the store's install/detail flow.
        const upToDate = installed && !hasUpdate;
        const packagePath = `${packagesRootPath}/${name}`;
        const open = () => {
          if (upToDate) history.push(packagePath);
          else openDnp(p.manifesthash);
        };

        return (
          <Card
            key={`${name}_${i}`}
            interactive
            padding="md"
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            }}
            className="group flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <AppAvatar pkg={pkg} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h5
                    className="line-clamp-2 break-words font-semibold capitalize text-fg"
                    title={title || name}
                  >
                    {title || name}
                  </h5>
                  {hasUpdate && (
                    <Badge variant="accent" className="flex-shrink-0">
                      Update
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-xs text-fg-subtle">v{version}</span>
              </div>
            </div>

            {description && (
              <p className="line-clamp-3 text-sm text-fg-muted">{description}</p>
            )}

            {installed && (
              <div className="text-xs text-fg-subtle">
                Installed{" "}
                <span className="font-medium text-fg-muted">
                  v{p.installedVersion}
                </span>
              </div>
            )}

            {upToDate ? (
              <Button
                as={Link}
                to={packagePath}
                variant="secondary"
                size="sm"
                pill
                className="mt-auto w-full"
                onClick={(e) => e.stopPropagation()}
              >
                Installed
              </Button>
            ) : (
              <Button
                variant={hasUpdate ? "primary" : "secondary"}
                size="sm"
                pill
                className="mt-auto w-full group-hover:border-accent/60 group-hover:text-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  open();
                }}
              >
                {hasUpdate ? `Update to v${version}` : "Install"}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

ManifestStore.propTypes = {
  directory: PropTypes.array.isRequired,
  openDnp: PropTypes.func.isRequired,
};

export default ManifestStore;
