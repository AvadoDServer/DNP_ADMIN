import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import * as action from "../../actions";
import { createStructuredSelector } from "reselect";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { Input } from "components/ui/Input";
import { SectionHeader } from "../PackagePresentation";
// Utils
import parseManifestEnvs from "pages/installer/parsers/parseManifestEnvs";

function parseEnvs(dnp, exclude) {
  const envs = {
    ...parseManifestEnvs(dnp.manifest),
    ...(dnp.envs || {}),
  };
  // Left out (e.g. secret setup fields, edited in the form above): not shown,
  // not sent, so the DAPPMANAGER keeps their current values
  for (const key of exclude || []) delete envs[key];
  return envs;
}

function Envs({ dnp, updateEnvs, exclude }) {
  const dnpEnvs = parseEnvs(dnp, exclude);
  const [envs, setEnvs] = useState(dnpEnvs);
  useEffect(() => {
    setEnvs(dnpEnvs);
  }, [dnp]);

  if (!Object.keys(dnpEnvs).length) return null;

  return (
    <section>
      <SectionHeader title="Environment variables" />
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {Object.entries(envs).map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-4"
            >
              <label
                htmlFor={`env-${key}`}
                className="break-all font-mono text-sm font-medium text-fg-muted"
              >
                {key}
              </label>
              <Input
                id={`env-${key}`}
                placeholder="enter value…"
                value={value || ""}
                onChange={(e) => setEnvs({ ...envs, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div>
          <Button variant="secondary" size="sm" onClick={() => updateEnvs(dnp.name, envs)}>
            Update environment variables
          </Button>
        </div>
      </Card>
    </section>
  );
}

// Container

const mapStateToProps = createStructuredSelector({});

const mapDispatchToProps = {
  updateEnvs: action.updatePackageEnv,
};

export default connect(mapStateToProps, mapDispatchToProps)(Envs);
