import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import api from "API/rpcMethods";
// UI kit
import Card from "components/ui/Card";
import { Input } from "components/ui/Input";
import Switch from "components/Switch";
import { SectionHeader } from "../PackagePresentation";
import Terminal from "./Terminal";
// Utils
import { stringIncludes } from "utils/strings";

const refreshInterval = 2 * 1000;
const terminalID = "terminal";

const validateLines = lines => !isNaN(lines) && lines > 0;

function Logs({ id }) {
  // User options
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState(200);
  // Fetched data
  const [logs, setLogs] = useState("");

  /**
   * This use effect fetches the logs again everytime any of this variables changes:
   * - autoRefresh, timestamps, lines, dnp
   * In case of a fetch error, it will stop the autoRefresh
   * On every first fetch, it will automatically scroll to the bottom
   * On every first fetch, it will display "fetching..."
   */
  useEffect(() => {
    let scrollToBottom = () => {
      const el = document.getElementById(terminalID);
      if (el) el.scrollTop = el.scrollHeight;
      scrollToBottom = () => {};
    };

    async function logDnp() {
      try {
        const options = { timestamps, tail: lines };
        const logs = await api.logPackage({ id, options });
        if (typeof logs !== "string") throw Error("Logs must be a string");
        setLogs(logs);
        // Auto scroll to bottom (deffered after the paint)
        setTimeout(scrollToBottom, 10);
      } catch (e) {
        setLogs(`Error fetching logs: ${e.message}`);
        setAutoRefresh(false);
      }
    }
    if (autoRefresh && validateLines(lines)) {
      setLogs("fetching...");
      const interval = setInterval(logDnp, refreshInterval);
      return () => {
        clearInterval(interval);
      };
    }
  }, [autoRefresh, timestamps, lines, id]);

  /**
   * Filter the logs text by lines that contain the query
   * If the query is empty, skip the filter
   * If the query returned no matching logs, display custom message
   * If the lines parameter is not valid, display custom message
   */
  const logsArray = (logs || "").split(/\r?\n/);
  let logsFiltered = query
    ? logsArray.filter(line => stringIncludes(line, query)).join("\n")
    : logs;
  if (logs && query && !logsFiltered) logsFiltered = "No match found";

  const terminalText = validateLines(lines)
    ? logsFiltered
    : "Lines must be a number > 0";

  return (
    <section>
      <SectionHeader title="Logs" />
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Switch
            checked={autoRefresh}
            onToggle={setAutoRefresh}
            label="Auto-refresh logs"
            id="switch-ar"
          />
          <Switch
            checked={timestamps}
            onToggle={setTimestamps}
            label="Display timestamps"
            id="switch-ts"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Lines"
            type="number"
            placeholder="Number of lines to display…"
            value={lines}
            onChange={(e) => setLines(e.target.value)}
          />
          <Input
            label="Search"
            placeholder="Filter by…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Terminal text={terminalText} id={terminalID} />
      </Card>
    </section>
  );
}

Logs.propTypes = {
  id: PropTypes.string.isRequired
};

export default Logs;
