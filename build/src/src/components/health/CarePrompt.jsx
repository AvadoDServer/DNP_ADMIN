import { useState } from "react";
import { Link } from "react-router-dom";
import { showCarePrompt, readCarePromptHiddenUntil, hideCarePrompt } from "health/carePrompt";

/**
 * One muted line under Home's findings, offering Priority Care while the box
 * has a real problem (see health/carePrompt.js for when). "Not now" puts it
 * away for 30 days.
 *
 * @param {Array} findings the findings Home lists
 * @param {Array} packages installed packages
 */
export default function CarePrompt({ findings, packages }) {
  const [hiddenUntil, setHiddenUntil] = useState(readCarePromptHiddenUntil);
  if (!showCarePrompt({ findings, packages, hiddenUntil })) return null;

  return (
    <p className="mb-0 text-sm text-fg-muted">
      Want an email the next time something like this happens? Priority Care watches your AVADO for you. 14 days free.{" "}
      <Link to="/priority" className="font-medium text-accent hover:underline">See Priority Care</Link>
      <span aria-hidden="true"> · </span>
      <button type="button" className="font-medium hover:text-fg" onClick={() => setHiddenUntil(hideCarePrompt())}>
        Not now
      </button>
    </p>
  );
}
