import React from "react";
import PropTypes from "prop-types";
// Imgs
import errorAvatar from "img/errorAvatar.png";
import ipfsLogo from "img/IPFS-badge-small.png";
import defaultAvatar from "img/defaultAvatar.png";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { stringIncludes } from "utils/strings";

/**
 * Search-result / IPFS package grid. Same redux data shape as before — only
 * presentation is modernized onto the design system.
 */
function PackageStore({ directory, openDnp }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {directory.map((dnp, i) => {
        const { manifest, error, avatar = defaultAvatar, origin, tag } =
          dnp || {};
        const { name, description, keywords = [] } = manifest || {};
        /* Show the button as disabled (gray) if it's updated */
        const disabled = stringIncludes(tag, "updated");
        /* Rename tag from "install" to "get" because there were too many
           "install" tags. Cannot change the actual tag because it is used for
           logic around the installer */
        const tagDisplay = tag === "INSTALL" ? "Get" : tag;

        return (
          <Card
            key={`${name}_${origin}_${i}`}
            interactive
            padding="md"
            role="button"
            tabIndex={0}
            onClick={() => openDnp(origin)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDnp(origin);
              }
            }}
            className="group flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <img
                src={error ? errorAvatar : avatar}
                alt=""
                onError={(e) => {
                  e.currentTarget.src = defaultAvatar;
                }}
                className="h-12 w-12 flex-shrink-0 rounded-lg border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <h5 className="truncate font-semibold capitalize text-fg" title={name}>
                  {name}
                </h5>
                {origin && typeof origin === "string" ? (
                  <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                    <img src={ipfsLogo} alt="" className="h-4 w-4" />
                    <span className="truncate">{origin.replace("/ipfs/", "")}</span>
                  </span>
                ) : (
                  <span className="truncate text-xs text-fg-subtle">
                    {keywords.join(", ") || "AVADO package"}
                  </span>
                )}
              </div>
            </div>

            {description && (
              <p className="line-clamp-2 text-sm text-fg-muted">{description}</p>
            )}

            <Button
              variant="secondary"
              size="sm"
              pill
              disabled={disabled}
              className="mt-auto w-full group-hover:border-accent/60 group-hover:text-accent"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) openDnp(origin);
              }}
            >
              {disabled ? "Up to date" : tagDisplay || "Get"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

PackageStore.propTypes = {
  directory: PropTypes.array.isRequired,
  openDnp: PropTypes.func.isRequired,
};

export default PackageStore;
