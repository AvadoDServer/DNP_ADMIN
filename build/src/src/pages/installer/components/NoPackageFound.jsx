import React from "react";
import newTabProps from "utils/newTabProps";
// UI kit
import { StoreEmpty } from "./StorePresentation";

const PACKAGE_SURVEY_LINK = "https://goo.gl/forms/EjVTHu6UBWBk60Z62";

function NoPackageFound({ query }) {
  return (
    <StoreEmpty
      icon={
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      }
      title="Package not found"
      action={
        <a
          href={PACKAGE_SURVEY_LINK}
          {...newTabProps}
          className="inline-flex h-8 select-none items-center justify-center gap-1.5 rounded-md border border-accent/60 bg-transparent px-3 text-[0.8125rem] font-semibold text-accent transition-all duration-150 hover:border-accent hover:bg-accent/10 focus:outline-none focus-visible:shadow-focus"
        >
          Request {query}
        </a>
      }
    >
      If you would like a specific AVADO package to be developed, let us know in
      the survey.
    </StoreEmpty>
  );
}

export default NoPackageFound;
