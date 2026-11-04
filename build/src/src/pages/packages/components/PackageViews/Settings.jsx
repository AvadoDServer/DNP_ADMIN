import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import * as action from "../../actions";
import { useMode } from "settings/ModeProvider";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";
import { SectionHeader } from "../PackagePresentation";
import { SetupField } from "pages/installer/components/InstallCardComponents/SetupFields";
import Envs from "./Envs";
// Utils
import { getSetupFields, currentEnvs, changedSettings, missingRequired } from "pages/installer/parsers/setupFields";

/**
 * The form values to start from: the current value of each plain field;
 * secret fields start empty (never pre-filled).
 */
function startValues(fields, current) {
  const out = {};
  for (const field of fields) out[field.env] = field.secret ? "" : String(current[field.env] ?? "");
  return out;
}

/**
 * Settings of a package that declares setup fields (manifest setupWizard):
 * one plain control per field and one "Save and restart" button, sending
 * only what changed through updatePackageEnv. In Advanced mode the raw
 * environment table follows under "Advanced", without the secret fields.
 */
export function SetupSettings({ dnp, fields, updateEnvs }) {
  const { isAdvanced } = useMode();
  const current = currentEnvs(dnp);
  const [values, setValues] = useState(() => startValues(fields, current));
  const [saving, setSaving] = useState(false);

  // Start again from the DAPPMANAGER's values when they change (after a
  // save, or a change elsewhere), not on every package list refresh, which
  // would wipe what the owner is typing. Secrets count only as set/not set.
  const currentKey = JSON.stringify(fields.map(f => (f.secret ? Boolean(current[f.env]) : current[f.env] ?? "")));
  useEffect(() => {
    setValues(startValues(fields, currentEnvs(dnp)));
  }, [currentKey]);

  const changes = changedSettings(fields, values, current);
  const missing = missingRequired(fields, values, current);
  const hasChanges = Object.keys(changes).length > 0;

  const onChange = (env, value) => setValues(v => ({ ...v, [env]: value }));

  async function save() {
    if (!hasChanges || missing.length) return;
    setSaving(true);
    try {
      await updateEnvs(dnp.name, changes);
    } finally {
      setSaving(false);
      // A typed secret is not kept in the page once it was sent
      setValues(v => {
        const next = { ...v };
        for (const field of fields) if (field.secret) next[field.env] = "";
        return next;
      });
    }
  }

  const secretEnvs = fields.filter(f => f.secret).map(f => f.env);

  return (
    <>
      <section>
        <SectionHeader title="Settings" />
        <Card padding="lg" className="flex flex-col gap-5">
          <div className="flex max-w-xl flex-col gap-5">
            {fields.map(field => {
              const isSet = Boolean(String(current[field.env] ?? "").trim());
              return (
                <SetupField
                  key={field.env}
                  field={field}
                  value={values[field.env] ?? ""}
                  onChange={onChange}
                  showOptional={false}
                  placeholder={field.secret && !isSet ? "Not set" : undefined}
                  note={field.secret && isSet ? "Saved and hidden. Leave empty to keep the current value." : undefined}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <Button variant="primary" size="sm" onClick={save} disabled={!hasChanges || missing.length > 0 || saving}>
                {saving ? "Saving…" : "Save and restart"}
              </Button>
            </div>
            {missing.length > 0 ? (
              <p className="mb-0 text-xs text-fg-subtle">Fill in: {missing.map(f => f.title).join(", ")}.</p>
            ) : (
              <p className="mb-0 text-xs text-fg-subtle">The app restarts to use the new settings.</p>
            )}
          </div>
        </Card>
      </section>
      {isAdvanced && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-medium text-fg-muted hover:text-fg">
            Advanced
          </summary>
          <div className="mt-3">
            <Envs dnp={dnp} exclude={secretEnvs} />
          </div>
        </details>
      )}
    </>
  );
}

/**
 * The app page's Settings tab: the package's setup fields when it declares
 * them, otherwise the environment table as before.
 */
export function PackageSettings({ dnp, updateEnvs }) {
  const fields = getSetupFields(dnp && dnp.manifest);
  if (!fields.length) return <Envs dnp={dnp} />;
  return (
    <div className="flex flex-col gap-5">
      <SetupSettings key={dnp.name} dnp={dnp} fields={fields} updateEnvs={updateEnvs} />
    </div>
  );
}

const mapDispatchToProps = {
  updateEnvs: action.updatePackageEnv,
};

export default connect(null, mapDispatchToProps)(PackageSettings);
