import React from "react";
import PropTypes from "prop-types";
import { createStructuredSelector } from "reselect";
import { connect } from "react-redux";
import BaseDropdown from "./BaseDropdown";
import { getChainData } from "services/chainData/selectors";
// Icons
import { FiBox } from "react-icons/fi";

const ChainData = ({ chainData }) => {
  if (!Array.isArray(chainData)) {
    console.error("chainData must be an array");
    return null;
  }

  return (
    <BaseDropdown
      name="Chain status"
      messages={chainData.map(
        ({ name, message, error, syncing, progress } = {}) => ({
          title: name,
          body: message,
          type: error ? "danger" : syncing ? "warning" : "success",
          progress: progress,
          showProgress: syncing
        })
      )}
      Icon={() => <FiBox size={"1.4em"} />}
      className={"chainstatus"}
      placeholder="Mainnet chain state is not available, click the report icon"
    />
  );
};

ChainData.propTypes = {
  chainData: PropTypes.array.isRequired
};

const mapStateToProps = createStructuredSelector({
  chainData: getChainData
});

export default connect(
  mapStateToProps,
  null
)(ChainData);
