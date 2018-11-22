import React from "react";
import { createStructuredSelector } from "reselect";
import { connect } from "react-redux";
import * as selector from "../selectors";
import * as action from "../actions";
import $ from "jquery";
// modules
import chains from "chains";
// Icons
import Link from "Icons/Link";
import Bell from "Icons/Bell";
// Utils
import parseType from "utils/parseType";
// Components
import NavbarTopDropdownMessages from "./NavbarTopDropdownMessages";

class NavbarTopView extends React.Component {
  componentDidMount() {
    $(() => {
      $('[data-toggle="popover"]').popover();
    });
  }

  render() {
    const chainInfo = Object.keys(this.props.chains).map(id => ({
      title: id,
      body: this.props.chains[id].msg,
      type: parseType(this.props.chains[id].status)
    }));

    let notificationsInfo = this.props.notifications;
    if (!notificationsInfo.length)
      notificationsInfo = [{ body: "No notifications yet" }];

    const dnIdn = this.props.dappnodeIdentity;

    return (
      <ul className="navbar-nav ml-auto">
        <li className="nav-item nav-item-infoText">
          <span
            data-container="body"
            data-toggle="popover"
            data-placement="bottom"
            data-content={Object.keys(dnIdn)
              .map(key => `<strong>${key}:</strong> ${dnIdn[key]}`)
              .join("<br/>")}
            data-html="true"
            style={{
              textTransform: "none",
              cursor: "pointer",
              padding: "0.5rem",
              display: "block"
            }}
          >
            {dnIdn.name}
          </span>
        </li>
        <NavbarTopDropdownMessages
          name={"Chain status"}
          messages={chainInfo}
          icon={Link}
        />
        <NavbarTopDropdownMessages
          name={"Notifications"}
          messages={notificationsInfo}
          icon={Bell}
          onClick={this.props.viewedNotifications}
        />
        <li className="nav-item nav-item-infoText">
          <a href="https://dappnode.io/" className="nav-link">
            About
          </a>
        </li>
        <li className="nav-item nav-item-infoText">
          <a href="https://dappnode.io/" className="nav-link">
            Donate
          </a>
        </li>
      </ul>
    );
  }
}

const mapStateToProps = createStructuredSelector({
  dappnodeIdentity: selector.getDappnodeIdentity,
  chains: chains.selectors.getAll,
  notifications: selector.getNotifications
});

const mapDispatchToProps = dispatch => {
  return {
    viewedNotifications: () => {
      dispatch(action.viewedNotifications());
    }
  };
};

const NavbarTop = connect(
  mapStateToProps,
  mapDispatchToProps
)(NavbarTopView);

export default NavbarTop;
