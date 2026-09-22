import React, { useEffect } from "react";
import { connect } from "react-redux";
import { compose } from "redux";
import { createStructuredSelector } from "reselect";
import { NavLink } from "react-router-dom";
import QRCode from "qrcode.react";
import withTitle from "components/hoc/withTitle";
// Own module
import * as a from "../actions";
import { rootPath } from "../data";
// Services
import { getDeviceById } from "services/devices/selectors";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
// Components
import { PageHeader } from "./DevicesPresentation";

function DevicesSettings({ device, getDeviceCredentials }) {
  const { id, url } = device;
  useEffect(() => {
    if (!url && id) getDeviceCredentials(id);
  }, [url, id]);

  return (
    <div className="animate-fade-in">
      <PageHeader title={id || "Device not found"} subtitle="VPN connection profile">
        <NavLink to={rootPath} className="ml-auto">
          <Button variant="secondary" size="sm">
            Back
          </Button>
        </NavLink>
      </PageHeader>

      <Card padding="lg" className="flex flex-col gap-5">
        <div
          className="rounded-md border border-warning/30 bg-warning/[0.08] px-4 py-3 text-sm text-fg"
          role="alert"
        >
          Beware of shoulder surfing attacks (unsolicited observers). This QR
          code will grant them access to your AVADO.
        </div>

        {url ? (
          <div className="mx-auto w-full max-w-[320px] rounded-lg bg-white p-4">
            <QRCode
              value={url}
              renderAs="svg"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Generating credentials…</p>
        )}
      </Card>
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  device: (state, ownProps) => getDeviceById(state, ownProps.match.params.id),
  // For the withTitle HOC
  subtitle: (_, ownProps) => ownProps.match.params.id
});

const mapDispatchToProps = {
  getDeviceCredentials: a.getDeviceCredentials
};

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  ),
  withTitle("Devices")
)(DevicesSettings);
