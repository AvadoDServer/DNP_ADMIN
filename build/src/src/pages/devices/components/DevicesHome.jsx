import React, { useState } from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
// Own module
import DeviceGrid from "./DeviceGrid";
import * as a from "../actions";
// Services
import { getDevices } from "services/devices/selectors";
import { getDappnodeParams } from "services/dappnodeStatus/selectors";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { Input } from "components/ui/Input";
// Components
import { PageHeader, SectionHeader } from "./DevicesPresentation";

const DevicesHome = ({
  deviceList,
  params,
  addDevice,
  removeDevice,
  resetDevice,
  toggleAdmin,
  getDeviceCredentials
}) => {
  const [id, setId] = useState("");

  const submit = () => {
    if (!id) return;
    addDevice(id);
    setId("");
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Connect (VPN)"
        subtitle="Create credentials so users and devices can reach your AVADO over VPN or WiFi."
      />

      <SectionHeader title="Add a user" />
      <Card padding="lg">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            className="flex-1"
            label="User login"
            placeholder="user login"
            value={id}
            // Ensure id contains only alphanumeric characters
            onChange={e => setId((e.target.value || "").replace(/\W/g, ""))}
          />
          <Button type="submit" variant="primary" disabled={!id}>
            Add user
          </Button>
        </form>
      </Card>

      <SectionHeader title="Users" count={deviceList.length} />
      <DeviceGrid
        params={params}
        devices={deviceList}
        removeDevice={removeDevice}
        resetDevice={resetDevice}
        toggleAdmin={toggleAdmin}
        getDeviceCredentials={getDeviceCredentials}
      />
    </div>
  );
};

const mapStateToProps = createStructuredSelector({
  deviceList: getDevices,
  params: getDappnodeParams
});

const mapDispatchToProps = {
  addDevice: a.addDevice,
  getDeviceCredentials: a.getDeviceCredentials,
  removeDevice: a.removeDevice,
  resetDevice: a.resetDevice,
  toggleAdmin: a.toggleAdmin
};

// withLoading is applied at DevicesRoot
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DevicesHome);
