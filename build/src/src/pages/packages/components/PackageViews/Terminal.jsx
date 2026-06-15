import React from "react";
import striptags from "striptags";
import AnsiUp from "ansi_up";

const ansi_up = new AnsiUp();

/**
 * Scrollable log terminal. Same ansi-to-html / striptags pipeline as before —
 * only the chrome is restyled onto the design tokens.
 */
export default function Terminal({ text, className, ...props }) {
  return (
    <div
      className={
        "max-h-[30rem] overflow-auto rounded-lg border border-border bg-bg-inset p-5 font-mono text-xs leading-relaxed text-fg [white-space:pre] " +
        (className || "")
      }
      dangerouslySetInnerHTML={{
        __html: ansi_up.ansi_to_html(striptags(text || "No input")),
      }}
      {...props}
    />
  );
}
