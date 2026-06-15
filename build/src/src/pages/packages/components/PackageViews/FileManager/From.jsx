import React, { useState } from "react";
import PropTypes from "prop-types";
import api from "API/rpcMethods";
// UI kit
import { Input } from "components/ui/Input";
import Button from "components/ui/Button";
// Utils
import { shortName } from "utils/format";
import dataUriToBlob from "utils/dataUriToBlob";
import { saveAs } from "file-saver";

function From({ id }) {
  const [fromPath, setFromPath] = useState("");

  async function downloadFile() {
    try {
      /**
       * [copyFileFrom]
       * Copy file from a DNP and download it on the client
       *
       * @param {string} id DNP .eth name
       * @param {string} fromPath path to copy file from
       * - If path = path to a file: "/usr/src/app/config.json".
       *   Downloads and sends that file
       * - If path = path to a directory: "/usr/src/app".
       *   Downloads all directory contents, tar them and send as a .tar.gz
       * - If path = relative path: "config.json".
       *   Path becomes $WORKDIR/config.json, then downloads and sends that file
       *   Same for relative paths to directories.
       * @returns {string} dataUri = "data:application/zip;base64,UEsDBBQAAAg..."
       */
      const dataUri = await api.copyFileFrom(
        { id, fromPath },
        { toastMessage: `Copying file from ${shortName(id)} ${fromPath}...` }
      );
      if (!dataUri) return;

      const blob = dataUriToBlob(dataUri);
      const fileName = parseFileName(fromPath, blob.type);

      saveAs(blob, fileName);
    } catch (e) {
      console.error(`Error on copyFileFrom ${id} ${fromPath}: ${e.stack}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-fg">Download from DApp</h3>
      <form
        className="flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (fromPath) downloadFile();
        }}
      >
        <Input
          className="flex-1"
          aria-label="Container path to download from"
          placeholder="Container from path"
          value={fromPath}
          onChange={(e) => setFromPath(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!fromPath}>
          Download
        </Button>
      </form>
    </div>
  );
}

function parseFileName(path, mimeType) {
  if (!path || typeof path !== "string") return path;
  const subPaths = path.split("/");
  let fileName = subPaths[subPaths.length - 1] || "";

  // Add extension in case it is a compressed directory
  if (
    (mimeType === "application/gzip" && !fileName.endsWith(".gzip")) ||
    !fileName.endsWith(".gz") ||
    !fileName.endsWith(".tar.gz")
  )
    fileName = `${fileName}.tar.gz`;

  return fileName;
}

From.propTypes = {
  id: PropTypes.string.isRequired
};

export default From;
