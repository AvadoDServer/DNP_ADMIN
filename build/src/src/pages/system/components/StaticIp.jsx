import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { createStructuredSelector } from "reselect";
import { connect } from "react-redux";
import * as a from "../actions";
import isIpv4 from "utils/isIpv4";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { Input } from "components/ui/Input";
// Components
import { SectionHeader } from "./SystemPresentation";
// External
import { getStaticIp } from "services/dappnodeStatus/selectors";

function StaticIp({ staticIp = "", setStaticIp }) {
  const [input, setInput] = useState(staticIp);

  useEffect(() => {
    setInput(staticIp);
  }, [staticIp]);

  const valid = isIpv4(input);
  const update = () => {
    if (valid) setStaticIp(input);
  };

  return (
    <section>
      <SectionHeader title="Static IP" />
      <Card padding="lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            className="flex-1"
            label="Static IP"
            placeholder="Your static ip…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") update();
            }}
          />
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!valid} onClick={update}>
              {staticIp ? "Update" : "Enable"}
            </Button>
            {staticIp && (
              <Button variant="danger" onClick={() => setStaticIp(null)}>
                Disable
              </Button>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

StaticIp.propTypes = {
  staticIp: PropTypes.string.isRequired,
  setStaticIp: PropTypes.func.isRequired
};

// Container

const mapStateToProps = createStructuredSelector({
  staticIp: getStaticIp
});

const mapDispatchToProps = {
  setStaticIp: a.setStaticIp
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(StaticIp);
