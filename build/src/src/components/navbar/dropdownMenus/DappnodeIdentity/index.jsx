import React from "react";
import PropTypes from "prop-types";
import { createStructuredSelector } from "reselect";
import { connect } from "react-redux";
import CTE from "react-click-to-edit";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
import "./DappnodeIdentity.css";
import * as a from "./actions";

/**
 * Identity details — box name (editable) and network identity (node ID,
 * external/internal IP). Used to live in its own top-bar dropdown; the
 * visual redesign moved identity out of the top bar, so this is now
 * rendered as plain content inside the sidebar footer's identity popover
 * (see SidebarFooter.jsx), which owns the trigger button and popover
 * chrome. This component only renders the fields themselves.
 */
const DappnodeIdentity = ({ dappnodeParams = {}, setName }) => {
  if (typeof dappnodeParams !== "object") {
    console.error("dappnodeParams must be an object");
    return null;
  }

  const name = dappnodeParams.name;

  const fullIdentity = {
    "External IP": dappnodeParams.ip,
    "Internal IP": dappnodeParams.internalip || dappnodeParams.internalIp,
    "Node ID": dappnodeParams.nodeid
  };

  const identityRows = Object.entries(fullIdentity).filter(([, value]) => value);

  return (
    <div className="dappnodeidentity flex flex-col gap-3 text-sm">
      <div>
        <div className="text-xs font-bold text-fg-subtle">Box name</div>
        {name ? (
          <CTE
            wrapperClass="CTE--text mt-1 block font-medium"
            textClass="text"
            inputClass="text"
            initialValue={name}
            endEditing={value => setName(value)}
          />
        ) : (
          <div className="mt-1 text-fg-muted">Unknown</div>
        )}
      </div>
      {identityRows.length ? (
        identityRows.map(([title, body]) => (
          <div key={title} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
            <div className="text-xs font-bold text-fg-subtle">{title}</div>
            <div className="mt-1 break-words text-fg-muted">{body}</div>
          </div>
        ))
      ) : (
        <div className="border-t border-border pt-3 text-fg-muted">No identity available yet.</div>
      )}
    </div>
  );
};

DappnodeIdentity.propTypes = {
  dappnodeParams: PropTypes.object.isRequired
};

const mapStateToProps = createStructuredSelector({
  dappnodeParams: getDappnodeParams
});

const mapDispatchToProps = {
  setName: a.setName
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DappnodeIdentity);
