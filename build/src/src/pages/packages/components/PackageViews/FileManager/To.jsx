import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import * as a from "../../../actions";
// UI kit
import { Input } from "components/ui/Input";
import Button from "components/ui/Button";
// Utils
import fileToDataUri from "utils/fileToDataUri";
import humanFileSize from "utils/humanFileSize";

const fileSizeWarning = 1e6;

function To({ id, copyFileTo }) {
  const [file, setFile] = useState(null);
  const [toPath, setToPath] = useState("");

  const { name, size } = file || {};

  async function uploadFile() {
    try {
      const dataUri = await fileToDataUri(file);
      /**
       * [copyFileTo]
       * Copy file to a DNP
       *
       * @param {string} id DNP .eth name
       * @param {string} dataUri = "data:application/zip;base64,UEsDBBQAAAg..."
       * @param {string} filename name of the uploaded file.
       * - MUST NOT be a path: "/app", "app/", "app/file.txt"
       * @param {string} toPath path to copy a file to
       * - If path = path to a file: "/usr/src/app/config.json".
       *   Copies the contents of dataUri to that file, overwritting it if necessary
       * - If path = path to a directory: "/usr/src/app".
       *   Copies the contents of dataUri to ${dir}/${filename}
       * - If path = relative path: "config.json".
       *   Path becomes $WORKDIR/config.json, then copies the contents of dataUri there
       *   Same for relative paths to directories.
       */
      copyFileTo({ id, dataUri, filename: name, toPath });
    } catch (e) {
      console.error(`Error on copyFileFrom ${id} ${toPath}: ${e.stack}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-fg">Upload to DApp</h3>

      {/* TO, choose source file */}
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-bg-subtle px-3 py-2.5 text-sm text-fg-muted transition-colors hover:border-accent/60 hover:text-fg focus-within:shadow-focus">
        <span className="inline-flex h-7 items-center rounded-md bg-surface px-2.5 text-xs font-semibold text-fg">
          Choose file
        </span>
        <span className="min-w-0 truncate">
          {name ? `${name} (${humanFileSize(size || 0)})` : "No file selected"}
        </span>
        <input
          type="file"
          className="sr-only"
          onChange={(e) => setFile(e.target.files[0])}
        />
      </label>

      {name && size > fileSizeWarning && (
        <div className="rounded-md border border-warning/25 bg-warning-subtle px-3 py-2 text-xs text-warning-text">
          This tool is not meant for large file transfers. Expect unstable
          behaviour.
        </div>
      )}

      {/* TO, choose destination path */}
      <form
        className="flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          uploadFile();
        }}
      >
        <Input
          className="flex-1"
          aria-label="Destination path"
          placeholder="Defaults to $WORKDIR/"
          value={toPath}
          onChange={(e) => setToPath(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!file}>
          Upload
        </Button>
      </form>
    </div>
  );
}

To.propTypes = {
  id: PropTypes.string.isRequired,
  copyFileTo: PropTypes.func.isRequired,
};

const mapDispatchToProps = {
  copyFileTo: a.copyFileTo,
};

export default connect(null, mapDispatchToProps)(To);
