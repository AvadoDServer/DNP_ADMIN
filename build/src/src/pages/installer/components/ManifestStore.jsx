import React from "react";
import PropTypes from "prop-types";
import semver from "semver";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import Badge from "components/ui/Badge";
import defaultAvatar from "img/defaultAvatar.png";

/**
 * DappStore category grid. Same redux/manifest data shape as before — only
 * presentation is modernized onto the design system.
 */
function ManifestStore({ directory, openDnp }) {
  const hashToUrl = (hash) => {
    if (!hash) return defaultAvatar;
    return `http://ipfs.my.ava.do:8080/ipfs/${hash.replace("/ipfs/", "")}`;
  };

  const visible = directory.filter((item) => {
    if (!item || !item.manifest || !item.manifest.hidden === true) return true;
    return false;
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((p, i) => {
        const { title, name, version, description, avatar } = p.manifest || {};
        const installed = Boolean(p.installed);
        const hasUpdate =
          installed &&
          p.installedVersion &&
          version &&
          semver.valid(version) &&
          semver.valid(p.installedVersion) &&
          semver.gt(version, p.installedVersion);

        return (
          <Card
            key={`${name}_${i}`}
            interactive
            padding="md"
            role="button"
            tabIndex={0}
            onClick={() => openDnp(p.manifesthash)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDnp(p.manifesthash);
              }
            }}
            className="group flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <img
                src={hashToUrl(avatar)}
                alt=""
                onError={(e) => {
                  e.currentTarget.src = defaultAvatar;
                }}
                className="h-12 w-12 flex-shrink-0 rounded-lg border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h5
                    className="truncate font-semibold capitalize text-fg"
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
                <span className="text-xs text-fg-subtle">v{version}</span>
              </div>
            </div>

            {description && (
              <p className="line-clamp-2 text-sm text-fg-muted">{description}</p>
            )}

            {installed && (
              <div className="text-xs text-fg-subtle">
                Installed{" "}
                <span className="font-medium text-fg-muted">
                  v{p.installedVersion}
                </span>
              </div>
            )}

            <Button
              variant={hasUpdate ? "primary" : "secondary"}
              size="sm"
              pill
              className="mt-auto w-full group-hover:border-accent/60 group-hover:text-accent"
              onClick={(e) => {
                e.stopPropagation();
                openDnp(p.manifesthash);
              }}
            >
              {hasUpdate ? "Update" : installed ? "Details" : "Install"}
            </Button>
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
