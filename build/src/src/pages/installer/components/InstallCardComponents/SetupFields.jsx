import React, { useState } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";

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

function SetupField({ field, value, onChange }) {
  const [show, setShow] = useState(false);
  const inputId = `setup-${field.env}`;
  const helpId = `${inputId}-help`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {field.title}
        {!field.required && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={field.secret && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(field.env, e.target.value)}
          required={field.required}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={field.description ? helpId : undefined}
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
      {field.description && (
        <p id={helpId} className="mb-0 text-xs leading-relaxed text-fg-subtle">
          <ReactMarkdown allowedTypes={HELP_TYPES} unwrapDisallowed renderers={helpRenderers}>
            {field.description}
          </ReactMarkdown>
        </p>
      )}
    </div>
  );
}

/**
 * The fields a package asks for before it is installed (manifest setupWizard).
 * @param {array} fields from parsers/setupFields getSetupFields
 * @param {object} values { ENV: "typed value" }
 * @param {function} onChange (env, value)
 */
export default function SetupFields({ fields, values, onChange }) {
  if (!fields || !fields.length) return null;
  return (
    <div className="mt-4 flex max-w-xl flex-col gap-4 border-t border-border pt-4">
      {fields.map(field => (
        <SetupField key={field.env} field={field} value={values[field.env] || ""} onChange={onChange} />
      ))}
    </div>
  );
}

SetupFields.propTypes = {
  fields: PropTypes.array.isRequired,
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired
};
