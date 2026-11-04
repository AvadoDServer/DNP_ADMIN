import React, { useState } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import { switchValue, isSwitchOn } from "pages/installer/parsers/setupFields";

const inputClass =
  "h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle transition-colors duration-150 focus:outline-none focus-visible:border-accent focus-visible:shadow-focus";

// One line of help: text, bold/italic, code and links only. Only http(s)
// links become links, opening in a new tab; raw HTML is never rendered
// (react-markdown escapes it).
const HELP_TYPES = ["text", "paragraph", "link", "strong", "emphasis", "inlineCode"];
const helpRenderers = {
  paragraph: ({ children }) => <span className="block">{children}</span>,
  link: ({ href, children }) =>
    /^https?:\/\//i.test(href || "") ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
        {children}
      </a>
    ) : (
      <>{children}</>
    )
};

function Help({ id, description, note }) {
  if (!description && !note) return null;
  return (
    <p id={id} className="mb-0 text-xs leading-relaxed text-fg-subtle">
      {description && (
        <ReactMarkdown allowedTypes={HELP_TYPES} unwrapDisallowed renderers={helpRenderers}>
          {description}
        </ReactMarkdown>
      )}
      {note && <span className="block">{note}</span>}
    </p>
  );
}

/**
 * One setup field (manifest setupWizard, see parsers/setupFields): a text box,
 * a masked text box with Show/Hide (secret), a drop-down (enum) or an on/off
 * switch (enum of "true"/"false").
 * @param {object} field from getSetupFields
 * @param {string} value
 * @param {function} onChange (env, value)
 * @param {string} placeholder optional
 * @param {string} note optional extra help line, under the description
 * @param {boolean} showOptional "(optional)" after the title of a field that is not required
 */
export function SetupField({ field, value, onChange, placeholder, note, showOptional = true }) {
  const [show, setShow] = useState(false);
  const inputId = `setup-${field.env}`;
  const helpId = `${inputId}-help`;
  const describedBy = field.description || note ? helpId : undefined;
  const optional = showOptional && !field.required && field.kind !== "boolean";

  if (field.kind === "boolean") {
    const on = isSwitchOn(value);
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span id={`${inputId}-label`} className="text-sm font-medium text-fg">
            {field.title}
          </span>
          <Help id={helpId} description={field.description} note={note} />
        </div>
        <button
          id={inputId}
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${inputId}-label`}
          aria-describedby={describedBy}
          onClick={() => onChange(field.env, switchValue(field, !on))}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus-visible:shadow-focus ${
            on ? "border-accent bg-accent" : "border-border bg-bg-subtle"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform duration-150 ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    );
  }

  const label = (
    <label htmlFor={inputId} className="text-sm font-medium text-fg">
      {field.title}
      {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
    </label>
  );

  if (field.kind === "select") {
    // A value outside the list (nothing chosen yet) shows "Choose…", as in
    // DAppNode's InputFieldSelect
    const known = field.options.includes(value);
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="relative">
          <select
            id={inputId}
            value={known ? value : ""}
            onChange={e => onChange(field.env, e.target.value)}
            required={field.required}
            aria-describedby={describedBy}
            className={`${inputClass} cursor-pointer appearance-none pr-9`}
          >
            {!known && (
              <option value="" disabled>
                Choose…
              </option>
            )}
            {field.options.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <Help id={helpId} description={field.description} note={note} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <div className="relative">
        <input
          id={inputId}
          type={field.secret && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(field.env, e.target.value)}
          required={field.required}
          placeholder={placeholder}
          autoComplete={field.secret ? "new-password" : "off"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={describedBy}
          className={field.secret ? `${inputClass} pr-16` : inputClass}
        />
        {field.secret && (
          <button
            type="button"
            onClick={() => setShow(x => !x)}
            aria-controls={inputId}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-control px-2.5 text-xs font-medium text-fg-muted hover:bg-fg/[0.06] hover:text-fg focus:outline-none focus-visible:shadow-focus"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      <Help id={helpId} description={field.description} note={note} />
    </div>
  );
}

SetupField.propTypes = {
  field: PropTypes.object.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  note: PropTypes.string,
  showOptional: PropTypes.bool
};

/**
 * The fields a package asks for before it is installed (manifest setupWizard).
 * @param {array} fields from parsers/setupFields getSetupFields
 * @param {object} values { ENV: "typed value" }
 * @param {object} defaults { ENV: "manifest default" }: what a switch or a
 *   drop-down shows until it is changed (nothing is sent then)
 * @param {function} onChange (env, value)
 */
export default function SetupFields({ fields, values, defaults = {}, onChange }) {
  if (!fields || !fields.length) return null;
  const valueOf = field => {
    if (values[field.env] !== undefined) return values[field.env];
    if (field.kind === "boolean" || field.kind === "select") return defaults[field.env] || "";
    return "";
  };
  return (
    <div className="mt-4 flex max-w-xl flex-col gap-4 border-t border-border pt-4">
      {fields.map(field => (
        <SetupField key={field.env} field={field} value={valueOf(field)} onChange={onChange} />
      ))}
    </div>
  );
}

SetupFields.propTypes = {
  fields: PropTypes.array.isRequired,
  values: PropTypes.object.isRequired,
  defaults: PropTypes.object,
  onChange: PropTypes.func.isRequired
};
