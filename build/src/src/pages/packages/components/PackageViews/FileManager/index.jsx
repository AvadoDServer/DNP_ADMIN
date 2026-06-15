import React from "react";
import PropTypes from "prop-types";
// UI kit
import Card from "components/ui/Card";
import { SectionHeader } from "../../PackagePresentation";
import To from "./To";
import From from "./From";

function FileManager({ dnp }) {
  const id = dnp.name;
  return (
    <section>
      <SectionHeader title="File manager" />
      <Card padding="lg" className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <To id={id} />
        <From id={id} />
      </Card>
    </section>
  );
}

FileManager.propTypes = {
  dnp: PropTypes.shape({
    name: PropTypes.string.isRequired,
  }).isRequired,
};

export default FileManager;
