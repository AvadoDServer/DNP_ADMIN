import React, { useEffect } from "react";
import ClipboardJS from "clipboard";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import { NavLink } from "react-router-dom";
import { superAdminId } from "services/devices/data";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
// UI kit
import Card from "components/ui/Card";
import Badge from "components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "components/ui/Table";
import { cn } from "components/ui/cn";
import Switch from "components/Switch";
import { confirm } from "components/ConfirmDialog";
// Components
import { EmptyState, iconBtn } from "./DevicesPresentation";
// Utils
import newTabProps from "utils/newTabProps";
// Icons
import { MdDelete, MdRefresh, MdShare } from "react-icons/md";
import { FaQrcode, FaDownload } from "react-icons/fa";
import { GoClippy } from "react-icons/go";

function DeviceGrid({
  devices,
  params,
  removeDevice,
  resetDevice,
  toggleAdmin,
  getDeviceCredentials
}) {
  // Activate the copy functionality
  useEffect(() => {
    const clipboard = new ClipboardJS(".copy");
    return () => clipboard.destroy();
  }, []);

  function removeDeviceConfirm(id) {
    confirm({
      title: `Removing ${id} device`,
      text: "The user using this device will lose access to this DAppNode ",
      label: "Remove",
      onClick: () => removeDevice(id)
    });
  }

  function resetDeviceConfirm(id) {
    const numOfAdmins = devices.filter(({ admin }) => admin).length;
    if (id === superAdminId || numOfAdmins === 1) {
      confirm({
        title: `WARNING! Reseting super admin`,
        text:
          "You should only reset the credentials of the super admin if you suspect an unwanted party gained access to this credentials. If that is the case, reset the credentials, BUT download and install the new credentials IMMEDIATELY. Otherwise, you will lose access to your DAppNode when this connection stops",
        label: `Reset ${id}`,
        onClick: () => resetDevice(id)
      });
    } else {
      confirm({
        title: `Reseting ${id} device`,
        text:
          "All profiles and links pointing to this device will no longer be valid",
        label: "Reset",
        onClick: () => resetDevice(id)
      });
    }
  }

  if (!devices.length) {
    return (
      <EmptyState title="No users yet">
        Add a user above to generate VPN credentials and a connection QR code.
      </EmptyState>
    );
  }

  const rows = devices.map(({ id, admin, url }) => {
    let url2;
    if (url && params) {
      url2 = `http://my.ava.do:8090/?localip=${params.internalip}&ip=${params.ip}&${url.split("?")[1]}`;
    }
    return { id, admin, url, url2 };
  });

  return (
    <Card padding="none" className="overflow-hidden">
      <Table>
        <THead>
          <TR className="border-b border-border">
            <TH>Name</TH>
            <TH>Role</TH>
            <TH align="center">Share</TH>
            <TH align="center">Admin</TH>
            <TH align="center">Reset</TH>
            <TH align="center">Remove</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map(({ id, admin, url, url2 }) => (
            <TR key={id}>
              <TD className="font-medium text-fg">{id}</TD>
              <TD>
                {admin ? (
                  <Badge variant="accent">Admin</Badge>
                ) : (
                  <Badge variant="neutral">User</Badge>
                )}
              </TD>
              <TD align="center">
                {url ? (
                  <div className="inline-flex items-center gap-1">
                    <NavLink
                      to={"/devices/" + id}
                      className={iconBtn}
                      aria-label={`Show ${id} QR code`}
                    >
                      <FaQrcode />
                    </NavLink>
                    <button
                      type="button"
                      className={cn(iconBtn, "copy")}
                      data-clipboard-text={url}
                      aria-label={`Copy ${id} connection link`}
                    >
                      <GoClippy />
                    </button>
                    {url2 && (
                      <a
                        href={url2}
                        {...newTabProps}
                        className={iconBtn}
                        aria-label={`Open ${id} connection`}
                      >
                        <FaDownload />
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => getDeviceCredentials(id)}
                    aria-label={`Generate ${id} credentials`}
                  >
                    <MdShare />
                  </button>
                )}
              </TD>
              <TD align="center">
                <div className="inline-flex">
                  <Switch checked={admin} onToggle={() => toggleAdmin(id)} />
                </div>
              </TD>
              <TD align="center">
                <button
                  type="button"
                  className={cn(iconBtn, "hover:text-warning")}
                  onClick={() => resetDeviceConfirm(id)}
                  aria-label={`Reset ${id}`}
                >
                  <MdRefresh />
                </button>
              </TD>
              <TD align="center">
                <button
                  type="button"
                  className={cn(
                    iconBtn,
                    admin
                      ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-fg-muted"
                      : "hover:text-danger"
                  )}
                  disabled={admin}
                  onClick={() => (admin ? null : removeDeviceConfirm(id))}
                  aria-label={`Remove ${id}`}
                >
                  <MdDelete />
                </button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

DeviceGrid.propTypes = {
  devices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      admin: PropTypes.bool,
      url: PropTypes.string
    })
  ).isRequired,
  removeDevice: PropTypes.func.isRequired,
  resetDevice: PropTypes.func.isRequired,
  toggleAdmin: PropTypes.func.isRequired,
  getDeviceCredentials: PropTypes.func.isRequired
};

const mapStateToProps = createStructuredSelector({
  dappnodeParams: getDappnodeParams
});

const mapDispatchToProps = {};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DeviceGrid);
