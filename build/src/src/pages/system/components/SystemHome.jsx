import React, { useEffect, useRef } from "react";
import { connect } from "react-redux";
import store from "../../../store";
import { getConnectionStatus } from "services/connectionStatus/selectors";
import { createStructuredSelector } from "reselect";
import { confirmAlert } from "react-confirm-alert"; // Import
import { title } from "../data";
import * as a from "../actions";
import { DISK_CLEANUP, SHUTDOWN } from "../signedCommands";
// Modules
import packages from "pages/packages";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
// Components
import { SectionHeader, Dialog, confirmSignedCmd } from "./SystemPresentation";

const PackageList = packages.components.PackageList;

/**
 * Shown while the box reboots. react-confirm-alert renders outside the app's
 * React tree, so this watches the store directly: once the connection has been
 * lost and is open again, the box is back and the dialog closes itself.
 */
function RebootingDialog({ onClose }) {
  const wentDown = useRef(false);
  useEffect(
    () =>
      store.subscribe(() => {
        const { isOpen } = getConnectionStatus(store.getState()) || {};
        if (!isOpen) wentDown.current = true;
        else if (wentDown.current) onClose();
      }),
    [onClose]
  );

  return (
    <Dialog
      heading="Rebooting"
      text={
        <>
          Your AVADO is now rebooting.
          <br />
          You will be disconnected for a few minutes. This page reconnects by
          itself once your AVADO is back. If you are connected over WiFi or VPN,
          you may have to reconnect first.
        </>
      }
    >
      <Button variant="secondary" onClick={onClose}>
        Dismiss
      </Button>
    </Dialog>
  );
}

const SystemHome = ({ rebootHost, runSignedCmd }) => {
  const rebooting = () => {
    // Outside customUI: that function runs on every render of the dialog
    rebootHost();
    confirmAlert({
      customUI: ({ onClose }) => <RebootingDialog onClose={onClose} />,
    });
  };

  const rebootConfirm = () => {
    confirmAlert({
      customUI: ({ onClose }) => (
        <Dialog
          heading="Reboot my AVADO box"
          text={
            <>
              Are you sure you want to reboot your AVADO?
              <br />
              Your settings will be saved and your packages will restart after
              the reboot.
            </>
          }
        >
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose();
              rebooting();
            }}
          >
            Reboot
          </Button>
        </Dialog>
      ),
    });
  };

  const maintenance = [
    {
      label: "Reboot my AVADO",
      description:
        "Reboot your AVADO. Useful if a package is misbehaving or CPU is at 100%.",
      variant: "secondary",
      onClick: rebootConfirm,
    },
    {
      label: "Disk cleanup",
      description:
        "Clean your SSD from left-over package data. (This will not remove any package data that is in use.)",
      variant: "secondary",
      onClick: () =>
        confirmSignedCmd(
          DISK_CLEANUP,
          {
            title: "Clean up disk",
            text: "Are you sure you want to perform a disk cleanup?",
          },
          runSignedCmd,
          "Disk cleanup"
        ),
    },
    {
      label: "Shutdown",
      description:
        "Stop all packages and shut down your AVADO. Press the power button to power on again.",
      variant: "danger",
      onClick: () =>
        confirmSignedCmd(
          SHUTDOWN,
          {
            title: "Shut down your AVADO",
            text: "Are you sure you want to shut down your AVADO?",
          },
          runSignedCmd,
          "Shut down"
        ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <SectionHeader title="Core packages" first />
      <PackageList
        moduleName={title}
        coreDnps={true}
        showRestart={false}
        showOpen={false}
      />

      <SectionHeader title="Maintenance" />
      <Card padding="none">
        <ul className="divide-y divide-border">
          {maintenance.map(({ label, description, variant, onClick }) => (
            <li
              key={label}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <div className="font-semibold text-fg">{label}</div>
                <p className="mt-0.5 text-sm text-fg-muted">{description}</p>
              </div>
              <Button
                variant={variant}
                size="sm"
                onClick={onClick}
                className="flex-shrink-0 sm:min-w-[10rem]"
              >
                {label}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

const mapStateToProps = createStructuredSelector({});

// Uses bindActionCreators to wrap action creators with dispatch
const mapDispatchToProps = {
  rebootHost: a.rebootHost,
  runSignedCmd: a.runSignedCmd,
};

export default connect(mapStateToProps, mapDispatchToProps)(SystemHome);
