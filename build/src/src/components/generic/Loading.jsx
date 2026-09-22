import React from "react";
import Spinner from "components/ui/Spinner";

/**
 * Full-height centered loading state. Used by App while connecting and by the
 * withLoading HOC. Token-driven — inherits dark/light from the theme.
 */
function Loading({ msg }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-fg-muted">
      <Spinner size="xl" className="text-accent" />
      {msg && <h4 className="text-base font-medium text-fg-muted">{msg}</h4>}
    </div>
  );
}

export default Loading;
