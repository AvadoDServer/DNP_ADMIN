import React, { useState } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { Link } from "react-router-dom";
// Selectors
import {
  getCoreUpdateAvailable,
  getUpdatingCore
} from "services/coreUpdate/selectors";
import { rootPath as systemRootPath, updatePath } from "pages/system/data";
// UI kit
import Button from "components/ui/Button";

const NotificationsView = ({ coreUpdateAvailable, updatingCore }) => {
  const [dismissed, setDismissed] = useState(false);

  if (!coreUpdateAvailable || updatingCore || dismissed) return null;

  return (
    <div
      role="alert"
      className="mb-5 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-text">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
        <p className="text-sm text-fg">
          <strong className="font-semibold">
            AVADO system update available.
          </strong>{" "}
          Click <strong className="font-semibold">Update</strong> to review and
          approve it.
        </p>
      </div>
      <div className="flex items-center gap-2 sm:flex-shrink-0">
        <Link to={systemRootPath + "/" + updatePath}>
          <Button variant="primary" size="sm">
            Update
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

const mapStateToProps = createStructuredSelector({
  coreUpdateAvailable: getCoreUpdateAvailable,
  updatingCore: getUpdatingCore
});

export default connect(
  mapStateToProps,
  null
)(NotificationsView);
